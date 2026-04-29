const mongoose = require('mongoose');

const reconciliationRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  config: {
    timestampToleranceSeconds: Number,
    quantityTolerancePct: Number,
  },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  summary: {
    matched: { type: Number, default: 0 },
    conflicting: { type: Number, default: 0 },
    userOnly: { type: Number, default: 0 },
    exchangeOnly: { type: Number, default: 0 },
  }
});

module.exports = mongoose.model('ReconciliationRun', reconciliationRunSchema);
