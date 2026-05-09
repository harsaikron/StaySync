const { getDb } = require('../db/index');
const fs = require('fs');

afterAll(() => {
  const dbPath = require('path').join(__dirname, '..', 'staysync.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

test('creates all tables on first call', () => {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all().map(r => r.name);
  expect(tables).toEqual(expect.arrayContaining([
    'cameras', 'patients', 'events', 'alerts', 'reports'
  ]));
});

test('returns same instance on repeated calls', () => {
  const a = getDb();
  const b = getDb();
  expect(a).toBe(b);
});
