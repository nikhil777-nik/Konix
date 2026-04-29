const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  runId: { type: String, required: true, index: true },
  source: { type: String, enum: ['USER', 'EXCHANGE'], required: true },
  originalRow: { type: mongoose.Schema.Types.Mixed }, 
  isValid: { type: Boolean, default: true },
  invalidReason: { type: String },
  // Normalized fields:
  timestamp: { type: Date },
  quantity: { type: Number },
  type: { type: String },
  asset: { type: String },
});

module.exports = mongoose.model('Transaction', transactionSchema);
