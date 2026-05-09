const express = require('express');
const { getDb } = require('../db/index');
const { computePerformance } = require('../services/analytics');
const { generateSummary } = require('../services/gemma');

const router = express.Router();

router.get('/patients/:id/performance', (req, res) => {
  const days = Number(req.query.days) || 7;
  res.json(computePerformance(req.params.id, days));
});

router.get('/patients/:id/timeline', (req, res) => {
  const { filter = 'all', limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM events WHERE patient_id = ?';
  const params = [req.params.id];
  if (filter === 'alerts') { query += ' AND severity != ?'; params.push('low'); }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  res.json(getDb().prepare(query).all(...params));
});

router.post('/reports/generate/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const period = req.query.period || 'daily';
  const days = period === 'weekly' ? 7 : 1;
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const events = getDb().prepare(
    'SELECT type, severity, guidance, reasoning, created_at FROM events WHERE patient_id = ? AND created_at >= ? ORDER BY created_at ASC'
  ).all(patientId, since);
  const logText = events.map(e =>
    `[${new Date(e.created_at * 1000).toLocaleString()}] ${e.type} (${e.severity}): ${e.reasoning}`
  ).join('\n');
  try {
    const result = await generateSummary(logText, period);
    getDb().prepare(
      'INSERT INTO reports (patient_id, period, summary, suggestions, score) VALUES (?, ?, ?, ?, ?)'
    ).run(patientId, period, result.summary, JSON.stringify(result.suggestions || []), result.score || 0);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
