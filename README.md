# StaySync — Dementia Care Intelligence
### Gemma 4 for Good Hackathon · Kaggle × Google DeepMind

> **"Every 3 seconds, someone in the world develops dementia."**  
> StaySync brings Gemma 4's multimodal vision and reasoning directly into the home — privately, locally, and affordably — to protect the 55 million people living with dementia worldwide.

---

## The Problem

Dementia caregivers face impossible choices: leave a loved one unattended to run errands, or quit their jobs to provide 24/7 supervision. Professional care costs $5,000–$10,000/month. Falls, wandering, missed medication, and confusion go undetected for hours. Families carry this burden in silence.

**StaySync changes this** — a £30 ESP32-CAM module + Gemma 4 running locally on any home Mac gives caregivers eyes, ears, and an AI companion that understands what it sees.

---

## How Gemma 4 Powers It

StaySync uses **Gemma 4's multimodal vision + function calling** for four real-time detection tasks, running 100% on the local machine:

| Task | Gemma 4 Capability Used | Example Output |
|------|------------------------|----------------|
| **Confusion / Wandering** | Vision + reasoning | *"It looks like you might be feeling a little lost — let me help you find your chair."* |
| **Fall Detection** | Vision + severity scoring | *"I can see you've had a tumble — please stay still, help is coming."* |
| **Face & Visitor Detection** | Vision + patient state | *"You have a visitor — I hope you're having a lovely time."* |
| **Routine Adherence** | Vision + schedule context | *"Good morning! It's nearly breakfast time — shall we head to the kitchen?"* |

All guidance is spoken aloud (Web Speech API TTS) — designed for patients, not just caregivers.

### Function Calling
Gemma 4's structured JSON output acts as function calls — each frame triggers a pipeline that:
1. Calls `analyseImage(frame, "fall")` → `{ detected: true, severity: "critical", guidance: "..." }`
2. Calls `analyseImage(frame, "confusion")` → `{ detected: true, guidance: "..." }`
3. Routes results to alerts, caregiver notifications, and the activity log

### Why Local / On-Device Deployment
- **Privacy first** — no patient images leave the home network
- **No subscription** — runs on a Mac Mini or laptop, always on
- **Low latency** — Gemma 4 analysis completes in under 2 seconds per frame
- **Offline resilient** — works even if internet is down

---

## Features

### 🎥 Camera Intelligence
- **ESP32-CAM hardware** — £30 module, plugs into USB for power, streams over WiFi
- **USB auto-detection** — portal detects connected ESP32 via Web Serial API, registers automatically
- **Live frame polling** — portal polls local backend every 5 seconds, shows live feed
- **Multi-camera** — monitor bedroom, living room, kitchen simultaneously

### 🤖 AI Companion (FloatingAI)
- Powered by Gemma 4 (`gemma4:e4b` via Ollama)
- Answers caregiver questions warmly: *"What should I do when she seems confused?"*
- Speaks responses aloud for patients who can't read

### 👤 Patient Profiles
- Daily routine builder — Gemma 4 checks if patient is on schedule
- Medication reminders with AI verification
- Risk score tracking over time

### 🚨 Alert System
- Real-time alerts for falls, wandering, distress
- WhatsApp / SMS caregiver notifications (one tap)
- Activity log — 24-hour timeline of AI observations

### 📍 Location Awareness
- Safe zone GPS geofencing
- Alerts when patient leaves home area

### 📱 Progressive Web App
- Installable on phone home screen
- Works offline (service worker)
- Voice-first UI for elderly users

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Local Machine (Mac/PC)                    │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────────┐  │
│  │  Next.js     │    │  Express.js  │   │  Ollama       │  │
│  │  Portal      │◄──►│  Backend     │◄──►  Gemma 4      │  │
│  │  :3000       │    │  :3001       │   │  :11434       │  │
│  └──────────────┘    └──────┬───────┘   └───────────────┘  │
│                             │                               │
│                      ┌──────┴───────┐                       │
│                      │  SQLite DB   │                       │
│                      │  (local)     │                       │
│                      └──────────────┘                       │
└─────────────────────────────────────┬───────────────────────┘
                                      │ HTTP POST /upload
                         ┌────────────┴──────────┐
                         │   ESP32-CAM (WiFi)     │
                         │   JPEG frame every 5s  │
                         └────────────────────────┘
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| AI Vision | **Gemma 4** (`gemma4:e4b`) via Ollama — multimodal, function calling |
| Frontend | Next.js 16, React 19, Tailwind CSS, PWA |
| Backend | Node.js, Express 5, SQLite (better-sqlite3) |
| Hardware | ESP32-CAM (AI Thinker), Arduino IDE |
| USB Detection | Web Serial API (Chrome/Edge) |
| Voice | Web Speech API (TTS) |
| Database | SQLite — no cloud, fully local |

---

## Hackathon Category

**Health & Sciences** — StaySync addresses one of the most pressing global health crises: dementia care. It makes AI-powered home monitoring accessible to any family at £30 hardware cost, running entirely on existing home computers with full privacy.

### Impact Metrics (Potential)
- **55 million** people living with dementia globally
- **£30** hardware cost vs £5,000/month professional care
- **100% private** — all data stays in the home
- **Real-time** — Gemma 4 analysis within 2 seconds of each frame

---

## Quick Start

### Prerequisites
- macOS or Linux
- Node.js 18+
- [Ollama](https://ollama.com) (for Gemma 4 AI analysis)
- Google Chrome (for USB camera detection)

### 1. First-time setup
```bash
git clone https://github.com/harsaikron/StaySync.git
cd StaySync
chmod +x setup.sh start.sh
./setup.sh
```

### 2. Run everything
```bash
./start.sh
```

This starts:
- ✅ Ollama + Gemma 4 (`gemma4:e4b`)
- ✅ Backend at `http://localhost:3001`
- ✅ Portal at `http://localhost:3000`
- ✅ Opens browser automatically

### 3. Add ESP32-CAM
1. Flash the Arduino sketch: `firmware/esp32cam.ino`
   - Set `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL = http://YOUR_MAC_IP:3001`
   - Find Mac IP: `ipconfig getifaddr en0`
2. Portal → Cameras → Add Camera → ESP32-CAM
3. Click **Detect ESP32-CAM via USB** → pick port → press EN button
4. Camera auto-registers and frames appear live

---

## Project Structure

```
staysync/
├── start.sh              # One-command launcher (Ollama + backend + portal)
├── setup.sh              # First-time dependency installer
├── server.js             # Express backend entry point
├── db/
│   ├── index.js          # SQLite connection + schema init
│   └── schema.sql        # Database schema
├── routes/
│   ├── upload.js         # ESP32 frame ingestion → Gemma 4 analysis
│   ├── cameras.js        # Camera CRUD
│   ├── patients.js       # Patient profiles
│   ├── alerts.js         # Alert management
│   ├── reports.js        # Analytics reports
│   └── stream.js         # SSE real-time stream
├── services/
│   ├── gemma.js          # Gemma 4 multimodal analysis (4 prompt types)
│   ├── sse.js            # Server-Sent Events broadcaster
│   └── scheduler.js      # Routine check scheduler
├── firmware/
│   └── esp32cam.ino      # Arduino sketch for ESP32-CAM
└── portal/               # Next.js 16 frontend (PWA)
    ├── app/
    │   ├── page.jsx          # Home dashboard
    │   ├── cameras/          # Camera management + live view
    │   ├── patients/         # Patient profiles
    │   ├── alerts/           # Alert feed
    │   └── settings/         # Configuration
    ├── components/
    │   ├── FloatingAI.jsx    # Gemma 4 AI companion
    │   ├── BrowserCamera.jsx # Webcam streaming
    │   └── ScheduleReminder.jsx
    └── lib/
        ├── api.js            # Backend API client
        └── tts.js            # Text-to-speech
```

---

## Gemma 4 Usage Detail

### Model
- **Model**: `gemma4:e4b` (4-billion parameter edge model via Ollama)
- **Why gemma4:e4b**: Runs on a MacBook Air M1 in real-time. No GPU required.

### Multimodal Vision Prompts
Each frame triggers four parallel analyses:

```javascript
// Fall detection — real-time, spoken aloud if detected
{
  model: "gemma4:e4b",
  images: [base64Frame],
  prompt: "You are a caring AI companion... Check if the person has fallen...",
  format: "json"
}
// → { detected: true, severity: "critical", guidance: "I can see you've had a tumble..." }
```

### Structured Output (Function Calling Pattern)
All Gemma 4 responses use strict JSON format, acting as typed function returns:
- `analyseImage(frame, "fall")` → `FallResult`
- `analyseImage(frame, "confusion")` → `ConfusionResult`
- `analyseImage(frame, "face")` → `FaceResult`
- `analyseImage(frame, "routine")` → `RoutineResult`

Results are stored in SQLite, broadcast via SSE to the portal, and trigger alerts when needed.

---

## Video Demo

*[Video link — submitted with Kaggle entry]*

Shows:
1. `./start.sh` launching everything in one command
2. ESP32-CAM auto-detected via USB, registered in portal
3. Live frame feed with Gemma 4 analysis in real-time
4. Fall detection alert — spoken guidance to patient
5. AI companion answering caregiver question
6. WhatsApp alert to caregiver

---

## License

Apache 2.0 — same as Gemma 4 model license

---

*Built for the [Kaggle × Google DeepMind Gemma 4 for Good Hackathon](https://www.kaggle.com/competitions/gemma-4-good-hackathon) · Health & Sciences category*
