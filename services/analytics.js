const { getDb } = require('../db/index');

function computePerformance(patientId, days = 7) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const db = getDb();

  const events = db.prepare(
    'SELECT * FROM events WHERE patient_id = ? AND created_at >= ? ORDER BY created_at ASC'
  ).all(patientId, since);

  const total = events.length;
  const confusions = events.filter(e => e.type === 'confusion' && e.severity !== 'low');
  const wanderings = events.filter(e => e.type === 'wandering');
  const falls = events.filter(e => e.type === 'fall' && e.severity !== 'low');
  const criticals = events.filter(e => e.severity === 'critical');

  const confusionByHour = Array(24).fill(0);
  for (const e of confusions) {
    const hour = new Date(e.created_at * 1000).getHours();
    confusionByHour[hour]++;
  }

  const dailyMap = {};
  for (const e of confusions) {
    const day = new Date(e.created_at * 1000).toLocaleDateString();
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  }
  const dailyConfusion = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  const confusionRate = total > 0 ? (confusions.length / total) * 100 : 0;
  const fallRisk = Math.min(100, falls.length * 40 + criticals.length * 20 + confusionRate * 0.1);

  const medicineEvents = events.filter(e => e.type === 'medicine');
  const medicineCompleted = medicineEvents.filter(e => {
    try { return JSON.parse(e.raw_json)?.completed === true; } catch { return false; }
  });
  const medicineAdherence = medicineEvents.length > 0
    ? Math.round((medicineCompleted.length / medicineEvents.length) * 100)
    : null;

  const latestReport = db.prepare(
    'SELECT * FROM reports WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(patientId);

  return {
    patientId,
    days,
    totalEvents: total,
    confusionEpisodes: confusions.length,
    wanderingIncidents: wanderings.length,
    falls: falls.length,
    fallRisk: Math.round(fallRisk),
    medicineAdherence,
    confusionByHour,
    dailyConfusion,
    latestReport: latestReport ? {
      ...latestReport,
      suggestions: JSON.parse(latestReport.suggestions || '[]')
    } : null
  };
}

module.exports = { computePerformance };
