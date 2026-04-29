const express = require('express');
const reconciliationRoutes = require('./routes/reconciliationRoutes');

const app = express();

app.use(express.json());

app.use('/api', reconciliationRoutes);

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

module.exports = app;
