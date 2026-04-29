const reconciliationService = require('../services/reconciliationService');

exports.reconcile = async (req, res, next) => {
  try {
    if (!req.files || !req.files.user_transactions || !req.files.exchange_transactions) {
      return res.status(400).json({ error: 'Both user_transactions and exchange_transactions files are required.' });
    }

    const userFile = req.files.user_transactions[0].path;
    const exchangeFile = req.files.exchange_transactions[0].path;

    const configOverrides = {
      timestampToleranceSeconds: req.body.timestampToleranceSeconds ? Number(req.body.timestampToleranceSeconds) : undefined,
      quantityTolerancePct: req.body.quantityTolerancePct ? Number(req.body.quantityTolerancePct) : undefined,
    };

    const runId = await reconciliationService.runReconciliation(userFile, exchangeFile, configOverrides);

    // Return the runId immediately (async processing) or wait for it.
    // For simplicity, we can do it synchronously if it's small, but requirements say "Expose REST endpoints"
    // and real systems do it asynchronously. We'll return 200 with runId if we wait, or 202 if async.
    // The prompt implies returning JSON. Let's do it synchronously for the assignment so they can immediately fetch the report.
    // Wait, let's make it synchronous to make testing easier, since we aren't using a job queue like Bull.
    
    res.status(200).json({ message: 'Reconciliation completed', runId });
  } catch (error) {
    next(error);
  }
};

exports.getReport = async (req, res, next) => {
  try {
    const csvString = await reconciliationService.generateReportCsv(req.params.runId);
    if (!csvString) return res.status(404).json({ error: 'Run not found or no data' });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=report-${req.params.runId}.csv`);
    
    res.send(csvString);
  } catch (error) {
    next(error);
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    const summary = await reconciliationService.getSummary(req.params.runId);
    if (!summary) return res.status(404).json({ error: 'Run not found' });
    res.json(summary);
  } catch (error) {
    next(error);
  }
};

exports.getUnmatched = async (req, res, next) => {
  try {
    const unmatched = await reconciliationService.getUnmatched(req.params.runId);
    if (!unmatched) return res.status(404).json({ error: 'Run not found' });
    res.json(unmatched);
  } catch (error) {
    next(error);
  }
};
