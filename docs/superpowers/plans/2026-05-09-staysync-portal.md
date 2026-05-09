# StaySync Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack dementia care portal — local Express backend with Gemma 4 vision AI, Next.js frontend on Vercel, ESP32-CAM hardware integration, and mobile-first PWA with Web Speech API guidance.

**Architecture:** ESP32-CAM POSTs JPEGs to a local Express server which calls Ollama (Gemma 4) for vision analysis and pushes results via SSE to a Next.js portal hosted on Vercel. The patient's phone opens the portal in Chrome, which auto-speaks guidance using the Web Speech API. A Cloudflare Tunnel exposes the local backend publicly.

**Tech Stack:** Node.js 20, Express 5, better-sqlite3, multer, node-cron, Next.js 14 (App Router), Tailwind CSS, shadcn/ui, recharts, next-pwa, Ollama (gemma4:12b), Cloudflare Tunnel, Arduino IDE (ESP32-CAM firmware)

---

## File Map

### Backend (`/` — existing staysync directory)
```
server.js                   # Express entry point, mounts all routes
db/index.js                 # SQLite connection + schema bootstrap
db/schema.sql               # Table definitions
routes/upload.js            # POST /upload/:cameraId — core AI pipeline
routes/stream.js            # GET /stream/:cameraId — SSE push
routes/cameras.js           # GET/POST/DELETE /cameras, POST /cameras/register
routes/patients.js          # GET/POST/PUT /patients, GET/PUT /patients/:id
routes/alerts.js            # GET /alerts
routes/reports.js           # GET /patients/:id/performance, POST /reports/generate/:patientId, GET /patients/:id/timeline
services/gemma.js           # Ollama HTTP wrapper — analyseImage(base64, prompt) → JSON
services/analytics.js       # computePerformance(patientId, days) → metrics object
services/scheduler.js       # node-cron daily + weekly report jobs
services/sse.js             # In-memory SSE client registry — add/remove/broadcast
middleware/upload.js        # Multer disk storage config → uploads/
uploads/                    # Stored JPEG files
firmware/esp32cam.ino       # Arduino sketch for ESP32-CAM
```

### Frontend (`portal/` — new Next.js app)
```
portal/
  next.config.js                          # PWA config, env vars
  public/manifest.json                    # PWA manifest
  public/icons/                           # PWA icons (192, 512)
  app/
    layout.jsx                            # Root layout: BottomNav, SSEProvider, TTSProvider
    page.jsx                              # Redirect → /dashboard
    dashboard/page.jsx                    # Caregiver home: camera grid, alert banner, risk score
    patient/page.jsx                      # Patient screen: large text, auto-speak, repeat button
    cameras/page.jsx                      # Camera list: online/offline, remove
    cameras/setup/page.jsx                # Web Serial API: USB detect → WiFi form → flash
    patients/page.jsx                     # Patient list
    patients/[id]/page.jsx                # Patient profile: details, routine, assigned cameras
    patients/[id]/performance/page.jsx    # Analytics: charts, AI summary, suggestions
    patients/[id]/timeline/page.jsx       # Event timeline with thumbnails
    alerts/page.jsx                       # Alert log with thumbnails + dismiss
  components/
    BottomNav.jsx                         # Tab bar: Home/Cameras/Patients/Alerts
    AlertBanner.jsx                       # Pinned critical alert strip
    CameraGrid.jsx                        # JPEG snapshot grid, auto-refresh every 3s
    RiskScoreBar.jsx                      # 0–100 colour gradient bar
    StatCard.jsx                          # Reusable metric tile (number + label)
    AISummary.jsx                         # Gemma 4 narrative card
    AISuggestions.jsx                     # Tiered suggestions (real-time/daily/weekly)
    EventCard.jsx                         # Single timeline/alert entry with thumbnail
    PatientForm.jsx                       # Create/edit patient form
    RoutineEditor.jsx                     # Daily schedule editor (wake/meals/meds/sleep)
  lib/
    api.js                                # fetch wrapper: get(path), post(path, body), del(path)
    tts.js                                # speakText(text), cancelSpeech(), isSpeaking()
    sse.js                                # createSSEConnection(cameraId, onMessage) → cleanup fn
  providers/
    SSEProvider.jsx                       # React context: streams from all assigned cameras
    TTSProvider.jsx                       # React context: exposes speak(), autoSpeak state
```

---

## Task 1: Backend project setup + dependencies

**Files:**
- Modify: `package.json`
- Create: `server.js`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Install backend dependencies**

```bash
cd /Users/pavithraharsaikron/Downloads/staysync
npm install better-sqlite3 node-cron dotenv
npm install --save-dev jest supertest
```

Expected: `node_modules` updated, no errors.

- [ ] **Step 2: Add scripts to package.json**

Replace the `scripts` block in `package.json`:
```json
{
  "name": "staysync",
  "version": "1.0.0",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.6",
    "dotenv": "^16.4.5",
    "express": "^5.2.1",
    "multer": "^2.1.1",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 3: Create .env.example**

```bash
# .env.example
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:12b
TUNNEL_URL=https://staysync.yourdomain.com
PORT=3001
UPLOAD_DIR=uploads
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
uploads/
*.db
.env
portal/.next/
portal/node_modules/
```

- [ ] **Step 5: Create bare server.js**

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`StaySync backend running on port ${PORT}`));

module.exports = app;
```

- [ ] **Step 6: Verify server starts**

```bash
node server.js
# Expected: StaySync backend running on port 3001
curl http://localhost:3001/health
# Expected: {"ok":true}
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: initial backend scaffold with Express"
```

---

## Task 2: Database schema + connection

**Files:**
- Create: `db/schema.sql`
- Create: `db/index.js`

- [ ] **Step 1: Create schema.sql**

```sql
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
```

- [ ] **Step 2: Create db/index.js**

```js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'staysync.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
  }
  return db;
}

module.exports = { getDb };
```

- [ ] **Step 3: Write a test**

Create `tests/db.test.js`:
```js
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/db.test.js --verbose
# Expected: 2 tests pass
```

- [ ] **Step 5: Commit**

```bash
git add db/ tests/db.test.js
git commit -m "feat: SQLite schema + connection module"
```

---

## Task 3: SSE service

**Files:**
- Create: `services/sse.js`
- Create: `tests/sse.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/sse.test.js`:
```js
const { addClient, removeClient, broadcast, getClientCount } = require('../services/sse');

test('addClient registers a client for a cameraId', () => {
  const mockRes = { write: jest.fn() };
  addClient('cam1', mockRes);
  expect(getClientCount('cam1')).toBe(1);
  removeClient('cam1', mockRes);
});

test('broadcast writes to all clients for cameraId', () => {
  const mockRes1 = { write: jest.fn() };
  const mockRes2 = { write: jest.fn() };
  addClient('cam2', mockRes1);
  addClient('cam2', mockRes2);
  broadcast('cam2', { type: 'guidance', text: 'Take your medicine' });
  expect(mockRes1.write).toHaveBeenCalledWith(
    expect.stringContaining('Take your medicine')
  );
  expect(mockRes2.write).toHaveBeenCalledWith(
    expect.stringContaining('Take your medicine')
  );
  removeClient('cam2', mockRes1);
  removeClient('cam2', mockRes2);
});

test('broadcast does nothing if no clients for cameraId', () => {
  expect(() => broadcast('cam-nobody', { text: 'hi' })).not.toThrow();
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/sse.test.js --verbose
# Expected: FAIL — cannot find module '../services/sse'
```

- [ ] **Step 3: Implement services/sse.js**

```js
const clients = new Map();

function addClient(cameraId, res) {
  if (!clients.has(cameraId)) clients.set(cameraId, new Set());
  clients.get(cameraId).add(res);
}

function removeClient(cameraId, res) {
  clients.get(cameraId)?.delete(res);
}

function broadcast(cameraId, data) {
  const group = clients.get(cameraId);
  if (!group || group.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of group) res.write(payload);
}

function getClientCount(cameraId) {
  return clients.get(cameraId)?.size ?? 0;
}

module.exports = { addClient, removeClient, broadcast, getClientCount };
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/sse.test.js --verbose
# Expected: 3 tests pass
```

- [ ] **Step 5: Commit**

```bash
git add services/sse.js tests/sse.test.js
git commit -m "feat: SSE client registry service"
```

---

## Task 4: Gemma 4 service (Ollama wrapper)

**Files:**
- Create: `services/gemma.js`
- Create: `tests/gemma.test.js`

- [ ] **Step 1: Create services/gemma.js**

```js
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:12b';

const PROMPTS = {
  confusion: (time, routine) => `You are a dementia care AI assistant. Analyse this image of a patient.
Detect if the person appears confused (blank stare, disorientation), is wandering without purpose, or is in an unexpected location given the time ${time} and routine: ${routine}.
Return ONLY valid JSON with no markdown: {"detected": true|false, "type": "confusion|wandering|normal", "severity": "low|medium|critical", "guidance": "short spoken sentence for patient", "reasoning": "one sentence"}`,

  fall: () => `Analyse this image for fall or unsafe posture. Is the person on the floor, fallen, or in a dangerous position?
Return ONLY valid JSON with no markdown: {"detected": true|false, "severity": "low|medium|critical", "guidance": "short spoken sentence for patient", "reasoning": "one sentence"}`,

  face: () => `Are there multiple people visible in this image? Is the patient calm or distressed?
Return ONLY valid JSON with no markdown: {"multiple_people": true|false, "patient_state": "calm|distressed|neutral", "guidance": "short spoken sentence", "reasoning": "one sentence"}`,

  routine: (time, routineJson) => `Current time is ${time}. The patient schedule is: ${routineJson}.
Based on this image, is the patient doing the correct activity?
Return ONLY valid JSON with no markdown: {"on_schedule": true|false, "current_activity": "string", "expected_activity": "string", "guidance": "short spoken sentence", "reasoning": "one sentence"}`,

  medicine: (time, action, scheduledTime) => `The time is ${time}. The patient is due to ${action} at ${scheduledTime}.
Look at this image and determine if the patient has already done this.
Return ONLY valid JSON with no markdown: {"completed": true|false, "guidance": "short spoken sentence", "reasoning": "one sentence"}`
};

async function analyseImage(base64Image, promptType, context = {}) {
  const promptFn = PROMPTS[promptType];
  if (!promptFn) throw new Error(`Unknown prompt type: ${promptType}`);

  const prompt = promptFn(
    context.time || new Date().toLocaleTimeString(),
    context.routine || '{}',
    context.action,
    context.scheduledTime
  );

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      images: [base64Image],
      stream: false,
      format: 'json'
    })
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

  const data = await response.json();
  return JSON.parse(data.response);
}

async function generateSummary(eventLogText, period) {
  const prompt = `You are a dementia care analyst. Here is a ${period} log of patient events:\n${eventLogText}\n
Write a concise ${period} summary for the caregiver. Include: overall trend (improving/stable/declining), peak confusion times, recommendations.
Return ONLY valid JSON with no markdown: {"summary": "2-3 sentence narrative", "trend": "improving|stable|declining", "suggestions": ["suggestion1", "suggestion2", "suggestion3"], "score": 0-100}`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: 'json' })
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.response);
}

module.exports = { analyseImage, generateSummary, PROMPTS };
```

- [ ] **Step 2: Write a mock-based test**

Create `tests/gemma.test.js`:
```js
const { PROMPTS } = require('../services/gemma');

test('confusion prompt includes time and routine', () => {
  const prompt = PROMPTS.confusion('08:00 AM', 'breakfast');
  expect(prompt).toContain('08:00 AM');
  expect(prompt).toContain('breakfast');
  expect(prompt).toContain('"type": "confusion|wandering|normal"');
});

test('fall prompt requests fall detection JSON', () => {
  const prompt = PROMPTS.fall();
  expect(prompt).toContain('"detected"');
  expect(prompt).toContain('"severity"');
});

test('all prompt types are defined', () => {
  const types = ['confusion', 'fall', 'face', 'routine', 'medicine'];
  for (const t of types) {
    expect(typeof PROMPTS[t]).toBe('function');
  }
});
```

- [ ] **Step 3: Run test — expect PASS**

```bash
npx jest tests/gemma.test.js --verbose
# Expected: 3 tests pass
```

- [ ] **Step 4: Commit**

```bash
git add services/gemma.js tests/gemma.test.js
git commit -m "feat: Gemma 4 Ollama service with 5 detection prompts"
```

---

## Task 5: Multer middleware + upload directory

**Files:**
- Create: `middleware/upload.js`

- [ ] **Step 1: Create middleware/upload.js**

```js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const cam = req.params.cameraId || 'unknown';
    cb(null, `${cam}-${ts}.jpg`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG files accepted'));
    }
  }
});

module.exports = { upload };
```

- [ ] **Step 2: Commit**

```bash
git add middleware/upload.js
git commit -m "feat: multer disk storage middleware"
```

---

## Task 6: Camera routes

**Files:**
- Create: `routes/cameras.js`
- Create: `tests/cameras.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/cameras.test.js`:
```js
process.env.UPLOAD_DIR = 'uploads-test';
const request = require('supertest');
const express = require('express');
const fs = require('fs');

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/cameras', require('../routes/cameras'));
});

afterAll(() => {
  const db = require('../db/index').getDb();
  db.prepare('DELETE FROM cameras').run();
  const dbPath = require('path').join(__dirname, '..', 'staysync.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

test('POST /cameras/register creates a camera', async () => {
  const res = await request(app)
    .post('/cameras/register')
    .send({ id: 'cam-test-1', name: 'Living Room', location: 'living_room' });
  expect(res.status).toBe(201);
  expect(res.body.id).toBe('cam-test-1');
});

test('GET /cameras returns registered cameras', async () => {
  const res = await request(app).get('/cameras');
  expect(res.status).toBe(200);
  expect(res.body).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'cam-test-1', name: 'Living Room' })
  ]));
});

test('DELETE /cameras/:id removes a camera', async () => {
  const res = await request(app).delete('/cameras/cam-test-1');
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/cameras.test.js --verbose
# Expected: FAIL — cannot find module '../routes/cameras'
```

- [ ] **Step 3: Implement routes/cameras.js**

```js
const express = require('express');
const { getDb } = require('../db/index');

const router = express.Router();

router.get('/', (req, res) => {
  const cameras = getDb().prepare('SELECT * FROM cameras ORDER BY created_at DESC').all();
  const now = Math.floor(Date.now() / 1000);
  res.json(cameras.map(c => ({
    ...c,
    online: c.last_seen && (now - c.last_seen) < 15
  })));
});

router.post('/register', (req, res) => {
  const { id, name, location } = req.body;
  if (!id || !name || !location) return res.status(400).json({ error: 'id, name, location required' });
  getDb().prepare(
    'INSERT OR REPLACE INTO cameras (id, name, location) VALUES (?, ?, ?)'
  ).run(id, name, location);
  res.status(201).json({ id, name, location });
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM cameras WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/cameras.test.js --verbose
# Expected: 3 tests pass
```

- [ ] **Step 5: Commit**

```bash
git add routes/cameras.js tests/cameras.test.js
git commit -m "feat: camera CRUD routes"
```

---

## Task 7: Patient routes

**Files:**
- Create: `routes/patients.js`
- Create: `tests/patients.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/patients.test.js`:
```js
process.env.UPLOAD_DIR = 'uploads-test';
const request = require('supertest');
const express = require('express');
const fs = require('fs');

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/patients', require('../routes/patients'));
});

afterAll(() => {
  const dbPath = require('path').join(__dirname, '..', 'staysync.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

const patient = {
  id: 'pat-1',
  name: 'John Doe',
  age: 74,
  conditions: ['Alzheimer\'s'],
  medications: ['Donepezil 10mg'],
  emergency_contacts: [{ name: 'Jane Doe', phone: '555-0100' }],
  routine: { wake: '07:00', breakfast: '08:00', medicine: '08:15', lunch: '12:00', dinner: '18:00', sleep: '21:00' },
  camera_ids: []
};

test('POST /patients creates a patient', async () => {
  const res = await request(app).post('/').send(patient);
  expect(res.status).toBe(201);
  expect(res.body.name).toBe('John Doe');
});

test('GET /patients/:id returns patient', async () => {
  const res = await request(app).get('/pat-1');
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('John Doe');
  expect(res.body.conditions).toEqual(['Alzheimer\'s']);
});

test('PUT /patients/:id updates patient', async () => {
  const res = await request(app).put('/pat-1').send({ age: 75 });
  expect(res.status).toBe(200);
  const get = await request(app).get('/pat-1');
  expect(get.body.age).toBe(75);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/patients.test.js --verbose
# Expected: FAIL — cannot find module '../routes/patients'
```

- [ ] **Step 3: Implement routes/patients.js**

```js
const express = require('express');
const { getDb } = require('../db/index');
const { randomUUID } = require('crypto');

const router = express.Router();

const parse = (patient) => ({
  ...patient,
  conditions: JSON.parse(patient.conditions || '[]'),
  medications: JSON.parse(patient.medications || '[]'),
  emergency_contacts: JSON.parse(patient.emergency_contacts || '[]'),
  routine: JSON.parse(patient.routine || '{}'),
  camera_ids: JSON.parse(patient.camera_ids || '[]'),
  notes: JSON.parse(patient.notes || '[]')
});

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
  res.json(rows.map(parse));
});

router.post('/', (req, res) => {
  const { id, name, age, photo, conditions, medications, emergency_contacts, routine, camera_ids } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const patientId = id || randomUUID();
  getDb().prepare(`INSERT OR REPLACE INTO patients
    (id, name, age, photo, conditions, medications, emergency_contacts, routine, camera_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(patientId, name, age || null, photo || null,
    JSON.stringify(conditions || []),
    JSON.stringify(medications || []),
    JSON.stringify(emergency_contacts || []),
    JSON.stringify(routine || {}),
    JSON.stringify(camera_ids || [])
  );
  res.status(201).json(parse(getDb().prepare('SELECT * FROM patients WHERE id = ?').get(patientId)));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(parse(row));
});

router.put('/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const merged = { ...parse(existing), ...req.body };
  getDb().prepare(`UPDATE patients SET name=?, age=?, photo=?, conditions=?, medications=?,
    emergency_contacts=?, routine=?, camera_ids=?, notes=? WHERE id=?`
  ).run(merged.name, merged.age, merged.photo,
    JSON.stringify(merged.conditions),
    JSON.stringify(merged.medications),
    JSON.stringify(merged.emergency_contacts),
    JSON.stringify(merged.routine),
    JSON.stringify(merged.camera_ids),
    JSON.stringify(merged.notes),
    req.params.id
  );
  res.json(parse(getDb().prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id)));
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/patients.test.js --verbose
# Expected: 3 tests pass
```

- [ ] **Step 5: Commit**

```bash
git add routes/patients.js tests/patients.test.js
git commit -m "feat: patient CRUD routes with JSON field serialization"
```

---

## Task 8: Upload route (core AI pipeline)

**Files:**
- Create: `routes/upload.js`
- Create: `routes/stream.js`

- [ ] **Step 1: Create routes/stream.js**

```js
const express = require('express');
const { addClient, removeClient } = require('../services/sse');

const router = express.Router();

router.get('/:cameraId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  res.write('data: {"type":"connected"}\n\n');

  addClient(req.params.cameraId, res);

  req.on('close', () => removeClient(req.params.cameraId, res));
});

module.exports = router;
```

- [ ] **Step 2: Create routes/upload.js**

```js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { upload } = require('../middleware/upload');
const { getDb } = require('../db/index');
const { analyseImage } = require('../services/gemma');
const { broadcast } = require('../services/sse');

const router = express.Router();

const ALL_TYPES = ['confusion', 'fall', 'face', 'routine'];

router.post('/:cameraId', upload.single('photo'), async (req, res) => {
  const { cameraId } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

  // Update camera last_seen
  getDb().prepare('UPDATE cameras SET last_seen = ? WHERE id = ?')
    .run(Math.floor(Date.now() / 1000), cameraId);

  const photoPath = req.file.path;
  const base64 = fs.readFileSync(photoPath, 'base64');

  // Find patient assigned to this camera
  const patients = getDb().prepare('SELECT * FROM patients').all();
  const patient = patients.find(p => {
    const ids = JSON.parse(p.camera_ids || '[]');
    return ids.includes(cameraId);
  });

  const context = {
    time: new Date().toLocaleTimeString(),
    routine: patient ? patient.routine : '{}'
  };

  const results = [];

  for (const type of ALL_TYPES) {
    try {
      const result = await analyseImage(base64, type, context);
      result.promptType = type;

      const severity = result.severity || (result.detected === false ? 'low' : 'medium');
      const guidance = result.guidance || '';
      const reasoning = result.reasoning || '';

      const event = getDb().prepare(`INSERT INTO events
        (camera_id, patient_id, type, severity, guidance, reasoning, photo_path, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(cameraId, patient?.id || null, type, severity, guidance, reasoning, photoPath, JSON.stringify(result));

      // Create alert for medium/critical detections
      const isAlert = (result.detected === true && severity !== 'low') ||
                      (result.patient_state === 'distressed') ||
                      (result.on_schedule === false);

      if (isAlert) {
        getDb().prepare(`INSERT INTO alerts (event_id, patient_id, camera_id, severity, guidance, photo_path)
          VALUES (?, ?, ?, ?, ?, ?)`
        ).run(event.lastInsertRowid, patient?.id || null, cameraId, severity, guidance, photoPath);
      }

      broadcast(cameraId, { type: 'analysis', promptType: type, severity, guidance, reasoning, photoPath });
      results.push(result);
    } catch (err) {
      console.error(`Gemma analysis failed for type=${type}:`, err.message);
    }
  }

  res.json({ ok: true, cameraId, results });
});

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add routes/upload.js routes/stream.js
git commit -m "feat: upload route with Gemma 4 pipeline + SSE broadcast"
```

---

## Task 9: Alerts + reports routes + analytics service

**Files:**
- Create: `routes/alerts.js`
- Create: `routes/reports.js`
- Create: `services/analytics.js`
- Create: `services/scheduler.js`

- [ ] **Step 1: Create services/analytics.js**

```js
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

  // Confusion by hour of day
  const confusionByHour = Array(24).fill(0);
  for (const e of confusions) {
    const hour = new Date(e.created_at * 1000).getHours();
    confusionByHour[hour]++;
  }

  // Daily confusion counts for chart
  const dailyMap = {};
  for (const e of confusions) {
    const day = new Date(e.created_at * 1000).toLocaleDateString();
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  }
  const dailyConfusion = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  // Fall risk score: falls×40 + criticals×20 + confusion_rate×10, capped 100
  const confusionRate = total > 0 ? (confusions.length / total) * 100 : 0;
  const fallRisk = Math.min(100, falls.length * 40 + criticals.length * 20 + confusionRate * 0.1);

  // Medicine adherence: ratio of medicine events where completed=true
  const medicineEvents = events.filter(e => e.type === 'medicine');
  const medicineCompleted = medicineEvents.filter(e => {
    try { return JSON.parse(e.raw_json)?.completed === true; } catch { return false; }
  });
  const medicineAdherence = medicineEvents.length > 0
    ? Math.round((medicineCompleted.length / medicineEvents.length) * 100)
    : null;

  // Latest AI report
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
```

- [ ] **Step 2: Create routes/alerts.js**

```js
const express = require('express');
const { getDb } = require('../db/index');

const router = express.Router();

router.get('/', (req, res) => {
  const { patientId, severity, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM alerts WHERE dismissed = 0';
  const params = [];
  if (patientId) { query += ' AND patient_id = ?'; params.push(patientId); }
  if (severity) { query += ' AND severity = ?'; params.push(severity); }
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));
  res.json(getDb().prepare(query).all(...params));
});

router.post('/:id/dismiss', (req, res) => {
  getDb().prepare('UPDATE alerts SET dismissed = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 3: Create routes/reports.js**

```js
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
```

- [ ] **Step 4: Create services/scheduler.js**

```js
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
```

- [ ] **Step 5: Wire all routes into server.js**

Replace `server.js` with:
```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/cameras', require('./routes/cameras'));
app.use('/upload', require('./routes/upload'));
app.use('/stream', require('./routes/stream'));
app.use('/patients', require('./routes/patients'));
app.use('/alerts', require('./routes/alerts'));
app.use('/', require('./routes/reports'));
app.get('/health', (req, res) => res.json({ ok: true }));

if (require.main === module) {
  require('./services/scheduler').startScheduler();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`StaySync backend on port ${PORT}`));
}

module.exports = app;
```

- [ ] **Step 6: Run all tests**

```bash
npx jest --verbose
# Expected: all tests pass
```

- [ ] **Step 7: Commit**

```bash
git add routes/ services/ server.js
git commit -m "feat: alerts, reports, analytics, scheduler, full server wiring"
```

---

## Task 10: Next.js portal scaffold

**Files:**
- Create: `portal/` (entire Next.js app)

- [ ] **Step 1: Scaffold Next.js app with Tailwind**

```bash
cd /Users/pavithraharsaikron/Downloads/staysync
npx create-next-app@latest portal \
  --typescript=false \
  --tailwind \
  --eslint=false \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd portal
```

- [ ] **Step 2: Install UI dependencies**

```bash
npm install recharts next-pwa
npx shadcn@latest init --defaults
npx shadcn@latest add card badge button input label tabs progress
```

Expected: shadcn components installed in `components/ui/`.

- [ ] **Step 3: Create portal/.env.local**

```bash
# portal/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- [ ] **Step 4: Configure next.config.js for PWA**

Replace `portal/next.config.js`:
```js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true }
};

module.exports = withPWA(nextConfig);
```

- [ ] **Step 5: Create PWA manifest**

Create `portal/public/manifest.json`:
```json
{
  "name": "StaySync",
  "short_name": "StaySync",
  "description": "Dementia care companion",
  "start_url": "/patient",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#1f6feb",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 6: Create placeholder PWA icons**

```bash
mkdir -p portal/public/icons
# Download simple placeholder icons (192x192 and 512x512 blue squares)
node -e "
const { createCanvas } = require('canvas') || {};
// Fallback: just create placeholder files — replace with real icons before demo
const fs = require('fs');
fs.writeFileSync('portal/public/icons/icon-192.png', Buffer.alloc(0));
fs.writeFileSync('portal/public/icons/icon-512.png', Buffer.alloc(0));
console.log('Placeholder icons created — replace with real 192x192 and 512x512 PNG files');
"
```

Note: Replace these with real PNG icons before deploying. Use any image editor to create a 192×192 and 512×512 blue square with a 📷 emoji for the hackathon demo.

- [ ] **Step 7: Set global dark theme in app/globals.css**

Add to the top of `portal/app/globals.css` (keep the existing Tailwind directives):
```css
:root {
  --background: #0a0a0a;
  --foreground: #e6edf3;
}
body {
  background: #0a0a0a;
  color: #e6edf3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

- [ ] **Step 8: Commit**

```bash
cd portal && git add . && cd ..
git add portal/
git commit -m "feat: Next.js portal scaffold with Tailwind, shadcn, PWA config"
```

---

## Task 11: API client + TTS + SSE utilities

**Files:**
- Create: `portal/lib/api.js`
- Create: `portal/lib/tts.js`
- Create: `portal/lib/sse.js`

- [ ] **Step 1: Create portal/lib/api.js**

```js
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function del(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json();
}

export { get, post, del };
```

- [ ] **Step 2: Create portal/lib/tts.js**

```js
let currentUtterance = null;

export function speakText(text, { rate = 0.9, pitch = 1, lang = 'en-US' } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = lang;
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech() {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}

export function isSpeaking() {
  return typeof window !== 'undefined' && window.speechSynthesis?.speaking;
}
```

- [ ] **Step 3: Create portal/lib/sse.js**

```js
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function createSSEConnection(cameraId, onMessage) {
  if (typeof window === 'undefined') return () => {};
  const es = new EventSource(`${BASE}/stream/${cameraId}`);
  es.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  es.onerror = () => console.warn(`SSE error for camera ${cameraId}`);
  return () => es.close();
}
```

- [ ] **Step 4: Commit**

```bash
git add portal/lib/
git commit -m "feat: API client, TTS helper, SSE connection utility"
```

---

## Task 12: Providers (SSE + TTS context)

**Files:**
- Create: `portal/providers/SSEProvider.jsx`
- Create: `portal/providers/TTSProvider.jsx`

- [ ] **Step 1: Create portal/providers/TTSProvider.jsx**

```jsx
'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import { speakText, cancelSpeech } from '@/lib/tts';

const TTSContext = createContext(null);

export function TTSProvider({ children }) {
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [lastMessage, setLastMessage] = useState('');

  const speak = useCallback((text) => {
    setLastMessage(text);
    speakText(text);
  }, []);

  const repeat = useCallback(() => {
    if (lastMessage) speakText(lastMessage);
  }, [lastMessage]);

  return (
    <TTSContext.Provider value={{ speak, repeat, autoSpeak, setAutoSpeak, lastMessage, cancelSpeech }}>
      {children}
    </TTSContext.Provider>
  );
}

export const useTTS = () => useContext(TTSContext);
```

- [ ] **Step 2: Create portal/providers/SSEProvider.jsx**

```jsx
'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSSEConnection } from '@/lib/sse';
import { useTTS } from './TTSProvider';

const SSEContext = createContext(null);

export function SSEProvider({ cameraIds = [], children }) {
  const [latestEvents, setLatestEvents] = useState({});
  const [activeAlerts, setActiveAlerts] = useState([]);
  const { speak, autoSpeak } = useTTS();

  const subscribe = useCallback((cameraId) => {
    return createSSEConnection(cameraId, (data) => {
      if (data.type !== 'analysis') return;
      setLatestEvents(prev => ({ ...prev, [cameraId]: data }));
      if (data.severity === 'medium' || data.severity === 'critical') {
        setActiveAlerts(prev => [{ ...data, cameraId, id: Date.now() }, ...prev.slice(0, 9)]);
      }
      if (autoSpeak && data.guidance) speak(data.guidance);
    });
  }, [autoSpeak, speak]);

  useEffect(() => {
    const cleanups = cameraIds.map(subscribe);
    return () => cleanups.forEach(fn => fn());
  }, [JSON.stringify(cameraIds), subscribe]);

  return (
    <SSEContext.Provider value={{ latestEvents, activeAlerts, setActiveAlerts }}>
      {children}
    </SSEContext.Provider>
  );
}

export const useSSE = () => useContext(SSEContext);
```

- [ ] **Step 3: Create root layout with providers**

Replace `portal/app/layout.jsx`:
```jsx
import './globals.css';
import { TTSProvider } from '@/providers/TTSProvider';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: 'StaySync',
  description: 'Dementia care companion',
  manifest: '/manifest.json',
  themeColor: '#1f6feb'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-[#e6edf3] pb-20">
        <TTSProvider>
          {children}
          <BottomNav />
        </TTSProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add portal/providers/ portal/app/layout.jsx
git commit -m "feat: TTS + SSE providers, root layout"
```

---

## Task 13: Shared components

**Files:**
- Create: `portal/components/BottomNav.jsx`
- Create: `portal/components/AlertBanner.jsx`
- Create: `portal/components/CameraGrid.jsx`
- Create: `portal/components/RiskScoreBar.jsx`
- Create: `portal/components/StatCard.jsx`
- Create: `portal/components/AISummary.jsx`
- Create: `portal/components/EventCard.jsx`

- [ ] **Step 1: Create portal/components/BottomNav.jsx**

```jsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard', icon: '🏠', label: 'Home' },
  { href: '/cameras', icon: '📷', label: 'Cameras' },
  { href: '/patients', icon: '👤', label: 'Patients' },
  { href: '/alerts', icon: '🚨', label: 'Alerts' }
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-[#21262d] flex">
      {tabs.map(({ href, icon, label }) => {
        const active = path.startsWith(href);
        return (
          <Link key={href} href={href} className={`flex-1 flex flex-col items-center py-3 text-xs gap-1
            ${active ? 'text-[#1f6feb]' : 'text-[#8b949e]'}`}>
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create portal/components/AlertBanner.jsx**

```jsx
'use client';
export default function AlertBanner({ alerts, onDismiss }) {
  if (!alerts?.length) return null;
  const top = alerts[0];
  return (
    <div className="bg-[#3a1a1a] border border-[#f85149] rounded-lg p-3 mb-4 flex items-start gap-3">
      <span className="text-xl">🚨</span>
      <div className="flex-1">
        <div className="text-[#f85149] text-xs font-bold uppercase">
          {top.severity === 'critical' ? 'CRITICAL ALERT' : 'ALERT'} — Camera {top.cameraId}
        </div>
        <div className="text-[#e6edf3] text-sm mt-1">{top.guidance}</div>
      </div>
      <button onClick={() => onDismiss(top.id)}
        className="text-[#8b949e] text-xs px-2 py-1 border border-[#30363d] rounded">
        ✓ Handling
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create portal/components/CameraGrid.jsx**

```jsx
'use client';
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function CameraCard({ camera }) {
  const [ts, setTs] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTs(Date.now()), 3000);
    return () => clearInterval(interval);
  }, []);

  const src = `${BASE}/stream-snapshot/${camera.id}?t=${ts}`;

  return (
    <div className="bg-[#21262d] rounded-lg overflow-hidden">
      <div className="aspect-video bg-[#161b22] flex items-center justify-center">
        <img src={src} alt={camera.name} className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }} />
        <span className="text-4xl absolute">📷</span>
      </div>
      <div className="p-2 flex items-center justify-between">
        <span className="text-sm font-medium">{camera.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${camera.online
          ? 'bg-[#238636] text-white' : 'bg-[#30363d] text-[#8b949e]'}`}>
          {camera.online ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
    </div>
  );
}

export default function CameraGrid({ cameras }) {
  if (!cameras?.length) return (
    <div className="text-[#8b949e] text-center py-8">No cameras registered yet</div>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {cameras.map(c => <CameraCard key={c.id} camera={c} />)}
    </div>
  );
}
```

- [ ] **Step 4: Create portal/components/RiskScoreBar.jsx**

```jsx
export default function RiskScoreBar({ score = 0 }) {
  const colour = score < 33 ? '#3fb950' : score < 66 ? '#f78536' : '#f85149';
  return (
    <div className="bg-[#21262d] rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-[#8b949e] uppercase tracking-wide">Today's Risk Score</span>
        <span className="font-bold text-lg" style={{ color: colour }}>{score}</span>
      </div>
      <div className="h-2 bg-[#30363d] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: `linear-gradient(90deg, #3fb950, ${colour})` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create portal/components/StatCard.jsx**

```jsx
export default function StatCard({ value, label, colour = '#e6edf3', suffix = '' }) {
  return (
    <div className="bg-[#21262d] rounded-lg p-4 text-center">
      <div className="text-2xl font-bold" style={{ color: colour }}>
        {value ?? '—'}{suffix}
      </div>
      <div className="text-xs text-[#8b949e] mt-1 leading-tight">{label}</div>
    </div>
  );
}
```

- [ ] **Step 6: Create portal/components/AISummary.jsx**

```jsx
export default function AISummary({ report }) {
  if (!report) return (
    <div className="bg-[#1a1a2e] border border-[#6e40c9] rounded-lg p-4 text-[#8b949e] text-sm">
      No AI summary yet — check back after the first daily report runs at 11pm.
    </div>
  );
  return (
    <div className="bg-[#1a1a2e] border border-[#6e40c9] rounded-lg p-4">
      <div className="text-[#a371f7] text-xs font-bold uppercase tracking-wide mb-2">
        🤖 AI {report.period === 'weekly' ? 'Weekly' : 'Daily'} Summary
      </div>
      <p className="text-sm text-[#e6edf3] leading-relaxed mb-3">{report.summary}</p>
      {report.suggestions?.length > 0 && (
        <>
          <div className="text-[#f0883e] text-xs font-bold mb-1">💡 Suggestions</div>
          <ul className="text-xs text-[#8b949e] space-y-1">
            {report.suggestions.map((s, i) => <li key={i}>• {s}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create portal/components/EventCard.jsx**

```jsx
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SEVERITY_COLOURS = { low: '#8b949e', medium: '#f78536', critical: '#f85149' };

export default function EventCard({ event }) {
  const date = new Date(event.created_at * 1000).toLocaleString();
  const colour = SEVERITY_COLOURS[event.severity] || '#8b949e';
  return (
    <div className="bg-[#21262d] rounded-lg p-3 flex gap-3">
      {event.photo_path && (
        <img src={`${BASE}/${event.photo_path}`} alt="event"
          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
          onError={(e) => e.target.style.display = 'none'} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded"
            style={{ background: `${colour}22`, color: colour }}>
            {event.type}
          </span>
          <span className="text-xs text-[#8b949e]">{date}</span>
        </div>
        <p className="text-sm text-[#e6edf3] line-clamp-2">{event.guidance}</p>
        {event.reasoning && (
          <p className="text-xs text-[#8b949e] mt-1 line-clamp-1">{event.reasoning}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add portal/components/
git commit -m "feat: shared components — BottomNav, AlertBanner, CameraGrid, stats, EventCard"
```

---

## Task 14: Dashboard page

**Files:**
- Create: `portal/app/dashboard/page.jsx`
- Modify: `portal/app/page.jsx`

- [ ] **Step 1: Create redirect from root**

Replace `portal/app/page.jsx`:
```jsx
import { redirect } from 'next/navigation';
export default function Home() { redirect('/dashboard'); }
```

- [ ] **Step 2: Create portal/app/dashboard/page.jsx**

```jsx
'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import { useTTS } from '@/providers/TTSProvider';
import { SSEProvider, useSSE } from '@/providers/SSEProvider';
import AlertBanner from '@/components/AlertBanner';
import CameraGrid from '@/components/CameraGrid';
import RiskScoreBar from '@/components/RiskScoreBar';

function DashboardContent({ cameras }) {
  const { latestEvents, activeAlerts, setActiveAlerts } = useSSE();
  const { speak, autoSpeak, setAutoSpeak } = useTTS();
  const [performance, setPerformance] = useState(null);

  useEffect(() => {
    get('/patients').then(patients => {
      if (patients[0]) get(`/patients/${patients[0].id}/performance`).then(setPerformance);
    }).catch(() => {});
  }, []);

  const dismissAlert = (id) => setActiveAlerts(prev => prev.filter(a => a.id !== id));

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">StaySync 🏠</h1>
        <button onClick={() => setAutoSpeak(v => !v)}
          className={`text-xs px-3 py-1 rounded-full border ${autoSpeak
            ? 'border-[#238636] text-[#3fb950]' : 'border-[#30363d] text-[#8b949e]'}`}>
          🔊 Auto-speak {autoSpeak ? 'ON' : 'OFF'}
        </button>
      </div>

      <AlertBanner alerts={activeAlerts} onDismiss={dismissAlert} />

      {performance && <RiskScoreBar score={performance.fallRisk} />}

      <h2 className="text-sm font-bold text-[#8b949e] uppercase tracking-wide mt-4 mb-2">Live Cameras</h2>
      <CameraGrid cameras={cameras} />

      {Object.keys(latestEvents).length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-bold text-[#8b949e] uppercase tracking-wide mb-2">Latest Guidance</h2>
          {Object.entries(latestEvents).map(([camId, event]) => (
            <div key={camId} className="bg-[#21262d] rounded-lg p-3 mb-2">
              <div className="text-xs text-[#8b949e] mb-1">Camera {camId}</div>
              <div className="text-sm text-[#e6edf3]">{event.guidance}</div>
              <button onClick={() => speak(event.guidance)}
                className="mt-2 text-xs text-[#58a6ff]">🔊 Speak</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [cameras, setCameras] = useState([]);

  useEffect(() => { get('/cameras').then(setCameras).catch(() => {}); }, []);

  const cameraIds = cameras.map(c => c.id);

  return (
    <SSEProvider cameraIds={cameraIds}>
      <DashboardContent cameras={cameras} />
    </SSEProvider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add portal/app/dashboard/ portal/app/page.jsx
git commit -m "feat: dashboard page with live cameras, alert banner, risk score"
```

---

## Task 15: Patient screen (TTS auto-speak)

**Files:**
- Create: `portal/app/patient/page.jsx`

- [ ] **Step 1: Create portal/app/patient/page.jsx**

```jsx
'use client';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { useTTS } from '@/providers/TTSProvider';
import { SSEProvider, useSSE } from '@/providers/SSEProvider';

function PatientContent({ patientName }) {
  const { latestEvents } = useSSE();
  const { speak, repeat, lastMessage, autoSpeak, setAutoSpeak } = useTTS();
  const latestGuidance = Object.values(latestEvents)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0]?.guidance || '';

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7]
        flex items-center justify-center text-4xl mb-4">
        👤
      </div>

      <h1 className="text-3xl font-bold mb-1">Good {getTimeOfDay()}</h1>
      <p className="text-[#8b949e] text-lg mb-8">{patientName || 'Welcome'}</p>

      {lastMessage ? (
        <div className="bg-[#1a3a2a] border border-[#238636] rounded-2xl p-6 w-full max-w-sm mb-8">
          <div className="text-[#3fb950] text-xs font-bold uppercase tracking-wide mb-2">
            GUIDANCE
          </div>
          <p className="text-[#e6edf3] text-xl leading-relaxed">{lastMessage}</p>
        </div>
      ) : (
        <div className="bg-[#21262d] rounded-2xl p-6 w-full max-w-sm mb-8 text-[#8b949e]">
          Waiting for guidance...
        </div>
      )}

      <button onClick={repeat}
        className="w-full max-w-sm bg-[#1f6feb] text-white text-lg font-bold py-4 rounded-2xl mb-4">
        🔊 Repeat
      </button>

      <button onClick={() => setAutoSpeak(v => !v)}
        className={`text-sm px-4 py-2 rounded-full border ${autoSpeak
          ? 'border-[#238636] text-[#3fb950]' : 'border-[#30363d] text-[#8b949e]'}`}>
        Auto-speak is {autoSpeak ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function PatientPage() {
  const [cameras, setCameras] = useState([]);
  const [patientName, setPatientName] = useState('');

  useEffect(() => {
    get('/cameras').then(setCameras).catch(() => {});
    get('/patients').then(patients => {
      if (patients[0]) setPatientName(patients[0].name.split(' ')[0]);
    }).catch(() => {});
  }, []);

  return (
    <SSEProvider cameraIds={cameras.map(c => c.id)}>
      <PatientContent patientName={patientName} />
    </SSEProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/app/patient/
git commit -m "feat: patient screen with auto-speak TTS and repeat button"
```

---

## Task 16: Camera management + setup pages

**Files:**
- Create: `portal/app/cameras/page.jsx`
- Create: `portal/app/cameras/setup/page.jsx`

- [ ] **Step 1: Create portal/app/cameras/page.jsx**

```jsx
'use client';
import { useEffect, useState } from 'react';
import { get, del } from '@/lib/api';
import Link from 'next/link';

export default function CamerasPage() {
  const [cameras, setCameras] = useState([]);

  const load = () => get('/cameras').then(setCameras).catch(() => {});
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm('Remove this camera?')) return;
    await del(`/cameras/${id}`);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">📷 Cameras</h1>
        <Link href="/cameras/setup"
          className="bg-[#1f6feb] text-white text-sm px-4 py-2 rounded-lg">
          + Add Camera
        </Link>
      </div>

      {cameras.length === 0 ? (
        <div className="text-center py-16 text-[#8b949e]">
          <div className="text-4xl mb-3">📷</div>
          <p>No cameras yet.</p>
          <Link href="/cameras/setup" className="text-[#58a6ff] text-sm mt-2 block">
            Add your first camera →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cameras.map(c => (
            <div key={c.id} className="bg-[#21262d] rounded-lg p-4 flex items-center gap-3">
              <span className="text-2xl">📷</span>
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-[#8b949e]">
                  {c.location} · {c.online ? '🟢 Online' : '🔴 Offline'}
                  {c.last_seen && ` · Last seen ${new Date(c.last_seen * 1000).toLocaleTimeString()}`}
                </div>
              </div>
              <button onClick={() => remove(c.id)} className="text-[#f85149] text-sm">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create portal/app/cameras/setup/page.jsx**

```jsx
'use client';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useRouter } from 'next/navigation';

const BAUD_RATE = 115200;
const ENCODER = new TextEncoder();

export default function CameraSetupPage() {
  const router = useRouter();
  const [port, setPort] = useState(null);
  const [status, setStatus] = useState('idle');
  const [form, setForm] = useState({ name: '', location: '', ssid: '', password: '' });
  const [log, setLog] = useState([]);

  const addLog = (msg) => setLog(prev => [...prev, msg]);

  const connectSerial = async () => {
    try {
      setStatus('connecting');
      addLog('Requesting serial port access...');
      const p = await navigator.serial.requestPort();
      await p.open({ baudRate: BAUD_RATE });
      setPort(p);
      setStatus('connected');
      addLog('✓ ESP32-CAM connected via USB serial');
    } catch (err) {
      setStatus('error');
      addLog(`✗ Error: ${err.message}`);
    }
  };

  const flashCredentials = async () => {
    if (!port || !form.name || !form.ssid || !form.password) {
      alert('Fill all fields first');
      return;
    }
    try {
      setStatus('flashing');
      addLog('Sending WiFi credentials to ESP32-CAM...');

      const writer = port.writable.getWriter();
      const TUNNEL_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const payload = JSON.stringify({
        ssid: form.ssid,
        password: form.password,
        server_url: TUNNEL_URL
      }) + '\n';

      await writer.write(ENCODER.encode(payload));
      writer.releaseLock();

      addLog('✓ Credentials sent — waiting for camera to reboot and connect...');
      setStatus('waiting');

      // Poll for camera registration (ESP32 posts to /cameras/register on boot)
      await new Promise(r => setTimeout(r, 8000));

      // Derive camera ID from chip — for now register manually with name
      const camId = `esp32-${Date.now()}`;
      await post('/cameras/register', { id: camId, name: form.name, location: form.location });
      addLog(`✓ Camera "${form.name}" registered successfully!`);
      setStatus('done');

      setTimeout(() => router.push('/cameras'), 2000);
    } catch (err) {
      setStatus('error');
      addLog(`✗ Flash error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <h1 className="text-xl font-bold mb-2">📷 Add Camera</h1>
      <p className="text-[#8b949e] text-sm mb-6">Plug ESP32-CAM via USB, then follow the steps below.</p>

      {/* Step 1: Connect */}
      <div className="bg-[#21262d] rounded-lg p-4 mb-4">
        <div className="font-medium mb-3">Step 1 — Connect via USB</div>
        {status === 'idle' || status === 'error' ? (
          <button onClick={connectSerial}
            className="w-full bg-[#1f6feb] text-white py-3 rounded-lg font-medium">
            🔌 Connect Camera
          </button>
        ) : (
          <div className="text-[#3fb950] text-sm">✓ Connected</div>
        )}
        {!('serial' in navigator) && (
          <p className="text-[#f85149] text-xs mt-2">
            Web Serial API not supported. Use Chrome or Edge on a desktop.
          </p>
        )}
      </div>

      {/* Step 2: Details */}
      {(status === 'connected' || status === 'flashing' || status === 'waiting' || status === 'done') && (
        <div className="bg-[#21262d] rounded-lg p-4 mb-4 space-y-3">
          <div className="font-medium mb-1">Step 2 — Camera Details</div>
          {[
            { key: 'name', label: 'Camera name', placeholder: 'Living Room' },
            { key: 'location', label: 'Room / location', placeholder: 'living_room' },
            { key: 'ssid', label: 'WiFi network name (SSID)', placeholder: 'MyHomeWiFi' },
            { key: 'password', label: 'WiFi password', placeholder: '••••••••', type: 'password' }
          ].map(({ key, label, placeholder, type = 'text' }) => (
            <div key={key}>
              <label className="text-xs text-[#8b949e] block mb-1">{label}</label>
              <input type={type} value={form[key]} placeholder={placeholder}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2
                  text-[#e6edf3] text-sm focus:border-[#1f6feb] outline-none" />
            </div>
          ))}

          <button onClick={flashCredentials} disabled={status !== 'connected'}
            className="w-full bg-[#238636] text-white py-3 rounded-lg font-medium disabled:opacity-50">
            ⚡ Flash & Connect
          </button>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-[#161b22] rounded-lg p-3 font-mono text-xs text-[#8b949e] space-y-1">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add portal/app/cameras/
git commit -m "feat: camera list page + Web Serial API setup flow"
```

---

## Task 17: Patient list + profile pages

**Files:**
- Create: `portal/app/patients/page.jsx`
- Create: `portal/app/patients/[id]/page.jsx`
- Create: `portal/components/PatientForm.jsx`

- [ ] **Step 1: Create portal/components/PatientForm.jsx**

```jsx
'use client';
import { useState } from 'react';

const ROUTINE_KEYS = ['wake', 'breakfast', 'medicine', 'lunch', 'dinner', 'sleep'];

export default function PatientForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    age: initial.age || '',
    conditions: (initial.conditions || []).join(', '),
    medications: (initial.medications || []).join(', '),
    routine: initial.routine || {},
    camera_ids: initial.camera_ids || []
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setRoutine = (key, val) => setForm(f => ({ ...f, routine: { ...f.routine, [key]: val } }));

  const handleSave = () => {
    onSave({
      ...form,
      age: Number(form.age),
      conditions: form.conditions.split(',').map(s => s.trim()).filter(Boolean),
      medications: form.medications.split(',').map(s => s.trim()).filter(Boolean)
    });
  };

  return (
    <div className="space-y-4">
      {[{ key: 'name', label: 'Full name', placeholder: 'John Doe' },
        { key: 'age', label: 'Age', placeholder: '74', type: 'number' }
      ].map(({ key, label, placeholder, type = 'text' }) => (
        <div key={key}>
          <label className="text-xs text-[#8b949e] block mb-1">{label}</label>
          <input type={type} value={form[key]} placeholder={placeholder}
            onChange={e => set(key, e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb]" />
        </div>
      ))}

      <div>
        <label className="text-xs text-[#8b949e] block mb-1">Conditions (comma-separated)</label>
        <input value={form.conditions} onChange={e => set('conditions', e.target.value)}
          placeholder="Alzheimer's, Hypertension"
          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb]" />
      </div>

      <div>
        <label className="text-xs text-[#8b949e] block mb-1">Medications (comma-separated)</label>
        <input value={form.medications} onChange={e => set('medications', e.target.value)}
          placeholder="Donepezil 10mg, Lisinopril 5mg"
          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb]" />
      </div>

      <div>
        <label className="text-xs text-[#8b949e] block mb-2">Daily routine</label>
        <div className="space-y-2">
          {ROUTINE_KEYS.map(key => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-[#8b949e] w-20 capitalize">{key}</span>
              <input type="time" value={form.routine[key] || ''}
                onChange={e => setRoutine(key, e.target.value)}
                className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-sm text-[#e6edf3] outline-none" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave}
          className="flex-1 bg-[#238636] text-white py-3 rounded-lg font-medium">
          Save Patient
        </button>
        {onCancel && (
          <button onClick={onCancel}
            className="flex-1 border border-[#30363d] text-[#8b949e] py-3 rounded-lg">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create portal/app/patients/page.jsx**

```jsx
'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import Link from 'next/link';
import PatientForm from '@/components/PatientForm';

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = () => get('/patients').then(setPatients).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (data) => {
    await post('/patients', data);
    setAdding(false);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">👤 Patients</h1>
        <button onClick={() => setAdding(v => !v)}
          className="bg-[#1f6feb] text-white text-sm px-4 py-2 rounded-lg">
          {adding ? 'Cancel' : '+ Add Patient'}
        </button>
      </div>

      {adding && (
        <div className="bg-[#21262d] rounded-lg p-4 mb-4">
          <PatientForm onSave={save} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="space-y-3">
        {patients.map(p => (
          <Link key={p.id} href={`/patients/${p.id}`}
            className="block bg-[#21262d] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7]
                flex items-center justify-center text-xl">👤</div>
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-[#8b949e]">Age {p.age} · {p.conditions?.[0] || 'No conditions listed'}</div>
              </div>
            </div>
          </Link>
        ))}
        {patients.length === 0 && !adding && (
          <div className="text-center py-16 text-[#8b949e]">
            <div className="text-4xl mb-3">👤</div>
            <p>No patients yet. Add one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create portal/app/patients/[id]/page.jsx**

```jsx
'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PatientForm from '@/components/PatientForm';

const RISK_COLOUR = { Low: '#3fb950', Medium: '#f78536', High: '#f85149' };

export default function PatientDetailPage() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [perf, setPerf] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => {
    get(`/patients/${id}`).then(setPatient).catch(() => {});
    get(`/patients/${id}/performance`).then(setPerf).catch(() => {});
  };
  useEffect(() => { load(); }, [id]);

  const save = async (data) => {
    await post(`/patients/${id}`, data);
    setEditing(false);
    load();
  };

  if (!patient) return <div className="p-4 text-[#8b949e]">Loading...</div>;

  const riskLabel = (perf?.fallRisk || 0) < 33 ? 'Low' : (perf?.fallRisk || 0) < 66 ? 'Medium' : 'High';

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7]
          flex items-center justify-center text-3xl">👤</div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{patient.name}</h1>
          <div className="text-sm text-[#8b949e]">Age {patient.age}</div>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded"
          style={{ background: `${RISK_COLOUR[riskLabel]}22`, color: RISK_COLOUR[riskLabel] }}>
          {riskLabel} Risk
        </span>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link href={`/patients/${id}/performance`}
          className="bg-[#1a1a2e] border border-[#6e40c9] rounded-lg p-3 text-center">
          <div className="text-lg mb-1">📊</div>
          <div className="text-xs text-[#a371f7] font-bold">Performance</div>
        </Link>
        <Link href={`/patients/${id}/timeline`}
          className="bg-[#21262d] border border-[#30363d] rounded-lg p-3 text-center">
          <div className="text-lg mb-1">🕐</div>
          <div className="text-xs text-[#8b949e] font-bold">Timeline</div>
        </Link>
      </div>

      {/* Details */}
      {!editing ? (
        <>
          <Section title="Conditions">
            {patient.conditions?.map(c => (
              <span key={c} className="text-xs bg-[#21262d] px-2 py-1 rounded mr-2 mb-2 inline-block">{c}</span>
            ))}
          </Section>
          <Section title="Medications">
            {patient.medications?.map(m => (
              <div key={m} className="text-sm text-[#e6edf3] py-1 border-b border-[#21262d] last:border-0">{m}</div>
            ))}
          </Section>
          <Section title="Daily Routine">
            {Object.entries(patient.routine || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-1 border-b border-[#21262d] last:border-0">
                <span className="text-[#8b949e] capitalize">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </Section>
          <button onClick={() => setEditing(true)}
            className="w-full border border-[#30363d] text-[#8b949e] py-3 rounded-lg mt-4">
            ✏️ Edit Profile
          </button>
        </>
      ) : (
        <div className="bg-[#21262d] rounded-lg p-4">
          <PatientForm initial={patient} onSave={save} onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-[#8b949e] uppercase tracking-wide font-bold mb-2">{title}</div>
      <div className="bg-[#21262d] rounded-lg p-3">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add portal/app/patients/ portal/components/PatientForm.jsx
git commit -m "feat: patient list, profile, and form with routine editor"
```

---

## Task 18: Performance analytics page

**Files:**
- Create: `portal/app/patients/[id]/performance/page.jsx`
- Create: `portal/components/AISuggestions.jsx`

- [ ] **Step 1: Create portal/components/AISuggestions.jsx**

```jsx
export default function AISuggestions({ suggestions = [] }) {
  if (!suggestions.length) return null;
  return (
    <div className="bg-[#21262d] rounded-lg p-4">
      <div className="text-[#f0883e] text-xs font-bold uppercase tracking-wide mb-2">💡 AI Suggestions</div>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="text-sm text-[#8b949e] flex gap-2">
            <span className="text-[#f0883e]">•</span> {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Create portal/app/patients/[id]/performance/page.jsx**

```jsx
'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import { useParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '@/components/StatCard';
import AISummary from '@/components/AISummary';
import AISuggestions from '@/components/AISuggestions';

export default function PerformancePage() {
  const { id } = useParams();
  const [perf, setPerf] = useState(null);
  const [days, setDays] = useState(7);
  const [generating, setGenerating] = useState(false);

  const load = () => get(`/patients/${id}/performance?days=${days}`).then(setPerf).catch(() => {});
  useEffect(() => { load(); }, [id, days]);

  const generateReport = async () => {
    setGenerating(true);
    try {
      await post(`/reports/generate/${id}?period=daily`);
      await load();
    } finally {
      setGenerating(false);
    }
  };

  if (!perf) return <div className="p-4 text-[#8b949e]">Loading...</div>;

  const hourData = perf.confusionByHour.map((count, hour) => ({
    hour: `${hour}:00`, count
  })).filter(d => d.count > 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">📊 Performance</h1>
        <div className="flex gap-2">
          {[7, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs px-3 py-1 rounded-full border ${days === d
                ? 'border-[#1f6feb] text-[#58a6ff]' : 'border-[#30363d] text-[#8b949e]'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard value={perf.confusionEpisodes} label="Confusion Episodes" colour="#f78536" />
        <StatCard value={perf.falls} label="Falls" colour="#f85149" />
        <StatCard
          value={perf.medicineAdherence !== null ? perf.medicineAdherence : '—'}
          suffix={perf.medicineAdherence !== null ? '%' : ''}
          label="Medicine Adherence"
          colour="#3fb950" />
        <StatCard value={perf.fallRisk} label="Risk Score" colour={perf.fallRisk < 33 ? '#3fb950' : perf.fallRisk < 66 ? '#f78536' : '#f85149'} />
      </div>

      {/* Confusion heatmap by hour */}
      {hourData.length > 0 && (
        <div className="bg-[#21262d] rounded-lg p-4 mb-4">
          <div className="text-xs text-[#8b949e] uppercase font-bold mb-3">Confusion by Hour of Day</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={hourData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#8b949e' }} />
              <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {hourData.map((_, i) => <Cell key={i} fill="#f78536" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Summary */}
      <div className="mb-4">
        <AISummary report={perf.latestReport} />
      </div>

      {/* AI Suggestions */}
      {perf.latestReport?.suggestions && (
        <div className="mb-4">
          <AISuggestions suggestions={perf.latestReport.suggestions} />
        </div>
      )}

      {/* Generate report button */}
      <button onClick={generateReport} disabled={generating}
        className="w-full border border-[#6e40c9] text-[#a371f7] py-3 rounded-lg text-sm font-medium disabled:opacity-50">
        {generating ? '🤖 Generating...' : '🤖 Generate AI Report Now'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add portal/app/patients/ portal/components/AISuggestions.jsx
git commit -m "feat: performance analytics page with confusion heatmap + AI summary"
```

---

## Task 19: Timeline + alerts pages

**Files:**
- Create: `portal/app/patients/[id]/timeline/page.jsx`
- Create: `portal/app/alerts/page.jsx`

- [ ] **Step 1: Create portal/app/patients/[id]/timeline/page.jsx**

```jsx
'use client';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { useParams } from 'next/navigation';
import EventCard from '@/components/EventCard';

export default function TimelinePage() {
  const { id } = useParams();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    get(`/patients/${id}/timeline?filter=${filter}&limit=50`)
      .then(setEvents).catch(() => {});
  }, [id, filter]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <h1 className="text-xl font-bold mb-4">🕐 Timeline</h1>

      <div className="flex gap-2 mb-4">
        {['all', 'alerts'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border capitalize ${filter === f
              ? 'border-[#1f6feb] text-[#58a6ff]' : 'border-[#30363d] text-[#8b949e]'}`}>
            {f === 'all' ? 'All Events' : 'Alerts Only'}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-[#8b949e]">No events yet</div>
      ) : (
        <div className="space-y-3">
          {events.map(e => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create portal/app/alerts/page.jsx**

```jsx
'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import EventCard from '@/components/EventCard';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);

  const load = () => get('/alerts?limit=50').then(setAlerts).catch(() => {});
  useEffect(() => { load(); }, []);

  const dismiss = async (id) => {
    await post(`/alerts/${id}/dismiss`);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <h1 className="text-xl font-bold mb-4">🚨 Alerts</h1>

      {alerts.length === 0 ? (
        <div className="text-center py-16 text-[#8b949e]">
          <div className="text-4xl mb-3">✅</div>
          <p>No active alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <div key={a.id} className="relative">
              <EventCard event={{ ...a, type: 'alert', photo_path: a.photo_path }} />
              <button onClick={() => dismiss(a.id)}
                className="absolute top-3 right-3 text-xs text-[#8b949e] border border-[#30363d] px-2 py-1 rounded">
                ✓ Done
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add portal/app/patients/ portal/app/alerts/
git commit -m "feat: timeline and alerts pages"
```

---

## Task 20: ESP32-CAM firmware

**Files:**
- Create: `firmware/esp32cam.ino`

- [ ] **Step 1: Create firmware/esp32cam.ino**

```cpp
#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Camera model: AI-Thinker ESP32-CAM
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Config — set via serial JSON before WiFi connect
char ssid[64] = "";
char password[64] = "";
char serverUrl[128] = "http://localhost:3001";
String cameraId = "";

void readSerialConfig() {
  if (Serial.available()) {
    String json = Serial.readStringUntil('\n');
    json.trim();
    DynamicJsonDocument doc(512);
    if (deserializeJson(doc, json) == DeserializationError::Ok) {
      strlcpy(ssid, doc["ssid"] | "", sizeof(ssid));
      strlcpy(password, doc["password"] | "", sizeof(password));
      strlcpy(serverUrl, doc["server_url"] | "http://localhost:3001", sizeof(serverUrl));
      Serial.println("Config received OK");
    }
  }
}

void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
    cameraId = "esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    // Register camera with backend
    HTTPClient http;
    String regUrl = String(serverUrl) + "/cameras/register";
    http.begin(regUrl);
    http.addHeader("Content-Type", "application/json");
    String body = "{\"id\":\"" + cameraId + "\",\"name\":\"ESP32-CAM\",\"location\":\"room\"}";
    http.POST(body);
    http.end();
  } else {
    Serial.println("\nWiFi failed — check credentials");
  }
}

void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;
  esp_camera_init(&config);
}

void uploadPhoto() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { Serial.println("Camera capture failed"); return; }

  HTTPClient http;
  String url = String(serverUrl) + "/upload/" + cameraId;
  http.begin(url);
  http.addHeader("Content-Type", "image/jpeg");
  int code = http.POST(fb->buf, fb->len);
  if (code != 200) Serial.println("Upload failed: " + String(code));
  http.end();
  esp_camera_fb_return(fb);
}

void setup() {
  Serial.begin(115200);
  Serial.println("StaySync ESP32-CAM starting...");

  // Wait up to 10s for serial config
  unsigned long start = millis();
  while (millis() - start < 10000) {
    readSerialConfig();
    if (strlen(ssid) > 0) break;
    delay(100);
  }

  initCamera();
  if (strlen(ssid) > 0) connectWiFi();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED && cameraId.length() > 0) {
    uploadPhoto();
    delay(3000); // Upload every 3 seconds
  } else {
    readSerialConfig();
    if (strlen(ssid) > 0 && WiFi.status() != WL_CONNECTED) connectWiFi();
    delay(500);
  }
}
```

**Note:** In Arduino IDE, install these libraries via Library Manager before compiling:
- `ESP32` board package (by Espressif) via Board Manager
- `ArduinoJson` by Benoit Blanchon

Select board: `AI Thinker ESP32-CAM`

- [ ] **Step 2: Commit**

```bash
git add firmware/
git commit -m "feat: ESP32-CAM Arduino firmware with serial config + WiFi upload"
```

---

## Task 21: Snapshot endpoint + final server wiring

The `CameraGrid` component fetches `/stream-snapshot/:cameraId` — add this endpoint to return the latest saved JPEG for a camera.

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add snapshot route to server.js**

Add this block before the `/health` route in `server.js`:

```js
const path = require('path');
const fs = require('fs');

app.get('/stream-snapshot/:cameraId', (req, res) => {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const files = fs.readdirSync(uploadDir)
    .filter(f => f.startsWith(req.params.cameraId) && f.endsWith('.jpg'))
    .sort()
    .reverse();
  if (!files.length) return res.status(404).json({ error: 'No snapshot' });
  res.sendFile(path.resolve(uploadDir, files[0]));
});
```

- [ ] **Step 2: Start backend and verify all routes**

```bash
node server.js &
curl http://localhost:3001/health
curl http://localhost:3001/cameras
curl http://localhost:3001/patients
curl http://localhost:3001/alerts
# All expected to return 200 with JSON
```

- [ ] **Step 3: Start Next.js portal and verify it loads**

```bash
cd portal
npm run dev
# Open http://localhost:3000 in browser
# Expected: redirects to /dashboard, shows camera grid and bottom nav
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: snapshot endpoint, full system wiring complete"
```

---

## Task 22: Vercel deployment

**Files:**
- Create: `portal/vercel.json` (optional, for env var reminder)

- [ ] **Step 1: Install Vercel CLI and deploy**

```bash
cd portal
npm install -g vercel
vercel login
vercel --prod
```

When prompted:
- Project name: `staysync-portal`
- Framework: Next.js (auto-detected)
- Root directory: `./` (already in portal/)

- [ ] **Step 2: Set environment variable in Vercel dashboard**

1. Go to [vercel.com](https://vercel.com) → your project → Settings → Environment Variables
2. Add: `NEXT_PUBLIC_API_URL` = `https://your-cloudflare-tunnel-url.com`
3. Redeploy: `vercel --prod`

- [ ] **Step 3: Set up Cloudflare Tunnel**

```bash
# Install cloudflared
brew install cloudflared

# Authenticate (opens browser)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create staysync

# For demo without a domain — use trycloudflare (no account needed):
cloudflared tunnel --url http://localhost:3001
# Prints a random https://xxx.trycloudflare.com URL — use this as NEXT_PUBLIC_API_URL
```

- [ ] **Step 4: Run full system and test end-to-end**

Open three terminal tabs:

```bash
# Tab 1 — Ollama
ollama serve

# Tab 2 — Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3001

# Tab 3 — Backend
cd /Users/pavithraharsaikron/Downloads/staysync
node server.js
```

Then open the Vercel URL on your phone in Chrome:
1. Go to `/cameras/setup` → plug in ESP32-CAM via USB → connect + flash
2. Go to `/patients` → add a patient → assign the camera
3. Go to `/patient` → tap anywhere → guidance will auto-speak when camera sends photos
4. Go to `/dashboard` → watch live feed + alert banner

- [ ] **Step 5: Add to phone home screen**

On iPhone: Safari → Share → Add to Home Screen
On Android: Chrome → menu → Install App

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: StaySync complete — dementia care portal with Gemma 4 local AI"
```

---

## Self-Review Checklist

- [x] All spec pages covered: dashboard, patient, cameras, cameras/setup, patients/:id, performance, timeline, alerts
- [x] All backend routes covered: upload, stream, cameras, patients, alerts, reports, timeline, snapshot
- [x] Gemma 4 integration: all 5 prompt types (confusion, fall, face, routine, medicine)
- [x] SSE real-time push: service + stream route + SSEProvider
- [x] Web Speech API TTS: TTSProvider + patient page auto-speak + repeat button
- [x] Web Serial API camera setup: cameras/setup page with full flash flow
- [x] Performance analytics: confusion heatmap, stats grid, AI summary, suggestions
- [x] PWA: manifest, next-pwa config
- [x] Scheduler: daily + weekly cron jobs
- [x] ESP32-CAM firmware: serial config + WiFi + photo upload loop
- [x] Vercel + Cloudflare Tunnel deployment guide
- [x] Mobile-first dark theme throughout
