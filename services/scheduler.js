const cron = require('node-cron');
const { getDb } = require('../db/index');
const { generateSummary } = require('./gemma');

function startScheduler() {
  // Daily at 11pm
  cron.schedule('0 23 * * *', async () => {
    console.log('[scheduler] Running daily AI summary...');
    await runReports('daily', 1);
  });

  // Weekly on Sunday at 8pm
  cron.schedule('0 20 * * 0', async () => {
    console.log('[scheduler] Running weekly AI summary...');
    await runReports('weekly', 7);
  });
}

async function runReports(period, days) {
  const patients = getDb().prepare('SELECT id FROM patients').all();
  for (const { id } of patients) {
    try {
      const since = Math.floor(Date.now() / 1000) - days * 86400;
      const events = getDb().prepare(
        'SELECT type, severity, reasoning, created_at FROM events WHERE patient_id = ? AND created_at >= ?'
      ).all(id, since);
      if (events.length === 0) continue;
      const logText = events.map(e =>
        `[${new Date(e.created_at * 1000).toLocaleString()}] ${e.type} (${e.severity}): ${e.reasoning}`
      ).join('\n');
      const result = await generateSummary(logText, period);
      getDb().prepare(
        'INSERT INTO reports (patient_id, period, summary, suggestions, score) VALUES (?, ?, ?, ?, ?)'
      ).run(id, period, result.summary, JSON.stringify(result.suggestions || []), result.score || 0);
    } catch (err) {
      console.error(`[scheduler] Report failed for patient ${id}:`, err.message);
    }
  }
}

module.exports = { startScheduler };
