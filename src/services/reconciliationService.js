const { v4: uuidv4 } = require('uuid');
const { parseCsv } = require('./csvParser');
const Transaction = require('../models/Transaction');
const ReconciliationRun = require('../models/ReconciliationRun');
const ReportEntry = require('../models/ReportEntry');
const { createObjectCsvStringifier } = require('csv-writer');

const typeEquivalents = {
  'USER': { 'TRANSFER_OUT': 'TRANSFER_IN', 'TRANSFER_IN': 'TRANSFER_OUT', 'WITHDRAWAL': 'DEPOSIT', 'DEPOSIT': 'WITHDRAWAL' },
  'EXCHANGE': {} 
};

const getEquivalentType = (source, type) => {
  if (typeEquivalents[source] && typeEquivalents[source][type]) {
    return typeEquivalents[source][type];
  }
  return type;
};

exports.runReconciliation = async (userFile, exchangeFile, configOverrides) => {
  const runId = uuidv4();
  
  const defaultTimestampTolerance = parseInt(process.env.TIMESTAMP_TOLERANCE_SECONDS || 300, 10);
  const defaultQuantityTolerance = parseFloat(process.env.QUANTITY_TOLERANCE_PCT || 0.01);

  const config = {
    timestampToleranceSeconds: configOverrides.timestampToleranceSeconds ?? defaultTimestampTolerance,
    quantityTolerancePct: configOverrides.quantityTolerancePct ?? defaultQuantityTolerance,
  };

  const run = new ReconciliationRun({ runId, config, status: 'PENDING' });
  await run.save();

  try {
    const userRows = await parseCsv(userFile);
    const exchangeRows = await parseCsv(exchangeFile);

    const txsToInsert = [];
    userRows.forEach(row => txsToInsert.push({ runId, source: 'USER', ...row }));
    exchangeRows.forEach(row => txsToInsert.push({ runId, source: 'EXCHANGE', ...row }));
    
    await Transaction.insertMany(txsToInsert);

    const validUserTxs = txsToInsert.filter(tx => tx.source === 'USER' && tx.isValid);
    const validExchangeTxs = txsToInsert.filter(tx => tx.source === 'EXCHANGE' && tx.isValid);

    const exchangeTxMatched = new Set();
    const reportEntries = [];

    let matchedCount = 0;
    let conflictingCount = 0;
    let userOnlyCount = 0;
    let exchangeOnlyCount = 0;

    for (const uTx of validUserTxs) {
      const mappedUserType = getEquivalentType('USER', uTx.type);
      
      let bestMatch = null;
      let isConflicting = false;
      let minTimeDiff = Infinity;

      for (const eTx of validExchangeTxs) {
        if (exchangeTxMatched.has(eTx)) continue;

        if (uTx.asset === eTx.asset) {
          const eMappedType = getEquivalentType('EXCHANGE', eTx.type);
          if (mappedUserType === eMappedType || uTx.type === eTx.type) {
            
            const timeDiffSec = Math.abs(uTx.timestamp - eTx.timestamp) / 1000;
            const isTimeWithin = timeDiffSec <= config.timestampToleranceSeconds;
            
            const qtyDiffPct = Math.abs(uTx.quantity - eTx.quantity) / Math.max(uTx.quantity, eTx.quantity);
            const isQtyWithin = qtyDiffPct <= config.quantityTolerancePct;

            if (isTimeWithin && isQtyWithin) {
              if (timeDiffSec < minTimeDiff) {
                minTimeDiff = timeDiffSec;
                bestMatch = eTx;
                isConflicting = false;
              }
            } else if (isTimeWithin || isQtyWithin) {
              if (!bestMatch) {
                bestMatch = eTx;
                isConflicting = true;
              }
            }
          }
        }
      }

      if (bestMatch) {
        exchangeTxMatched.add(bestMatch);
        reportEntries.push({
          runId,
          category: isConflicting ? 'Conflicting' : 'Matched',
          reason: isConflicting ? 'Matched by proximity but timestamp or quantity beyond tolerance' : 'Matched within tolerance',
          userRow: uTx.originalRow,
          exchangeRow: bestMatch.originalRow
        });
        if (isConflicting) conflictingCount++;
        else matchedCount++;
      } else {
        reportEntries.push({
          runId,
          category: 'Unmatched (User only)',
          reason: 'No matching transaction found in exchange data',
          userRow: uTx.originalRow,
          exchangeRow: null
        });
        userOnlyCount++;
      }
    }

    for (const eTx of validExchangeTxs) {
      if (!exchangeTxMatched.has(eTx)) {
        reportEntries.push({
          runId,
          category: 'Unmatched (Exchange only)',
          reason: 'No matching transaction found in user data',
          userRow: null,
          exchangeRow: eTx.originalRow
        });
        exchangeOnlyCount++;
      }
    }

    const invalidTxs = txsToInsert.filter(tx => !tx.isValid);
    for (const invTx of invalidTxs) {
      reportEntries.push({
        runId,
        category: invTx.source === 'USER' ? 'Unmatched (User only)' : 'Unmatched (Exchange only)',
        reason: 'Invalid data: ' + invTx.invalidReason,
        userRow: invTx.source === 'USER' ? invTx.originalRow : null,
        exchangeRow: invTx.source === 'EXCHANGE' ? invTx.originalRow : null,
      });
      if (invTx.source === 'USER') userOnlyCount++;
      else exchangeOnlyCount++;
    }

    await ReportEntry.insertMany(reportEntries);

    run.status = 'COMPLETED';
    run.summary = { matched: matchedCount, conflicting: conflictingCount, userOnly: userOnlyCount, exchangeOnly: exchangeOnlyCount };
    await run.save();

    return runId;

  } catch (error) {
    run.status = 'FAILED';
    await run.save();
    throw error;
  }
};

exports.generateReportCsv = async (runId) => {
  const entries = await ReportEntry.find({ runId });
  if (!entries || entries.length === 0) return null;

  // Extract all unique headers from original rows to create dynamic CSV headers
  const headerSet = new Set();
  entries.forEach(entry => {
    if (entry.userRow) Object.keys(entry.userRow).forEach(k => headerSet.add(`User_${k}`));
    if (entry.exchangeRow) Object.keys(entry.exchangeRow).forEach(k => headerSet.add(`Exchange_${k}`));
  });

  const headerRecords = [
    { id: 'category', title: 'Category' },
    { id: 'reason', title: 'Reason' }
  ];
  
  headerSet.forEach(h => headerRecords.push({ id: h, title: h }));

  const csvStringifier = createObjectCsvStringifier({ header: headerRecords });

  const records = entries.map(entry => {
    const record = {
      category: entry.category,
      reason: entry.reason
    };
    if (entry.userRow) {
      for (const [k, v] of Object.entries(entry.userRow)) {
        record[`User_${k}`] = v;
      }
    }
    if (entry.exchangeRow) {
      for (const [k, v] of Object.entries(entry.exchangeRow)) {
        record[`Exchange_${k}`] = v;
      }
    }
    return record;
  });

  return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
};

exports.getSummary = async (runId) => {
  const run = await ReconciliationRun.findOne({ runId });
  if (!run) return null;
  return run.summary;
};

exports.getUnmatched = async (runId) => {
  const entries = await ReportEntry.find({ 
    runId, 
    category: { $in: ['Unmatched (User only)', 'Unmatched (Exchange only)'] } 
  });
  return entries;
};
