const mongoose = require('mongoose');

const reportEntrySchema = new mongoose.Schema({
  runId: { type: String, required: true, index: true },
  category: { 
    type: String, 
    enum: ['Matched', 'Conflicting', 'Unmatched (User only)', 'Unmatched (Exchange only)'] 
  },
  reason: { type: String },
  userRow: { type: mongoose.Schema.Types.Mixed },
  exchangeRow: { type: mongoose.Schema.Types.Mixed },
});

module.exports = mongoose.model('ReportEntry', reportEntrySchema);
