const express = require('express');

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/notes', require('./routes/notes'));

app.use((_req, res) => res.status(404).json({ error: 'Nie znaleziono' }));

module.exports = app;
