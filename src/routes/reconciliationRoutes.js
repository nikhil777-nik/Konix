const express = require('express');
const multer = require('multer');
const {
  reconcile,
  getReport,
  getSummary,
  getUnmatched
} = require('../controllers/reconciliationController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/reconcile', upload.fields([
  { name: 'user_transactions', maxCount: 1 },
  { name: 'exchange_transactions', maxCount: 1 }
]), reconcile);

router.get('/report/:runId', getReport);
router.get('/report/:runId/summary', getSummary);
router.get('/report/:runId/unmatched', getUnmatched);

module.exports = router;
