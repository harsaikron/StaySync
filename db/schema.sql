CREATE TABLE IF NOT EXISTS cameras (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  last_seen INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  photo TEXT,
  conditions TEXT DEFAULT '[]',
  medications TEXT DEFAULT '[]',
  emergency_contacts TEXT DEFAULT '[]',
  routine TEXT DEFAULT '{}',
  camera_ids TEXT DEFAULT '[]',
  notes TEXT DEFAULT '[]',
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  camera_id TEXT NOT NULL,
  patient_id TEXT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  guidance TEXT,
  reasoning TEXT,
  photo_path TEXT,
  raw_json TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  patient_id TEXT,
  camera_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  guidance TEXT,
  photo_path TEXT,
  dismissed INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  period TEXT NOT NULL,
  summary TEXT,
  suggestions TEXT DEFAULT '[]',
  score INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
