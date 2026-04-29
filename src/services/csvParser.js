const fs = require('fs');
const csv = require('csv-parser');

const findField = (row, possibleNames) => {
  for (let name of possibleNames) {
    for (let key of Object.keys(row)) {
      if (key.toLowerCase().includes(name)) return row[key];
    }
  }
  return null;
};

const parseCsv = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', (data) => {
        const timestampRaw = findField(data, ['timestamp', 'date', 'time', 'created_at']);
        const quantityRaw = findField(data, ['quantity', 'amount', 'size', 'value']);
        const typeRaw = findField(data, ['type', 'action', 'transaction_type', 'side']);
        const assetRaw = findField(data, ['asset', 'coin', 'currency', 'symbol']);

        let timestamp = timestampRaw ? new Date(timestampRaw) : null;
        let quantity = quantityRaw ? parseFloat(quantityRaw) : null;
        let type = typeRaw ? typeRaw.toUpperCase().trim() : null;
        let asset = assetRaw ? assetRaw.toUpperCase().trim() : null;
        
        if (asset === 'BITCOIN') asset = 'BTC';
        if (asset === 'ETHEREUM') asset = 'ETH';

        let isValid = true;
        let invalidReason = [];

        if (!timestamp || isNaN(timestamp.getTime())) {
          isValid = false;
          invalidReason.push('Invalid or missing timestamp');
          timestamp = null;
        }
        if (quantity === null || isNaN(quantity)) {
          isValid = false;
          invalidReason.push('Invalid or missing quantity');
        }
        if (!type) {
          isValid = false;
          invalidReason.push('Missing transaction type');
        }
        if (!asset) {
          isValid = false;
          invalidReason.push('Missing asset');
        }

        results.push({
          originalRow: data,
          isValid,
          invalidReason: invalidReason.join(', '),
          timestamp,
          quantity: quantity !== null && !isNaN(quantity) ? Math.abs(quantity) : null,
          type,
          asset
        });
      })
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

module.exports = { parseCsv };
