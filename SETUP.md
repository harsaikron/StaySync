# StaySync — Setup Guide

## What you need

| Component | Purpose |
|-----------|---------|
| Mac/Linux with 16GB RAM | Runs Ollama (Gemma 4) + backend |
| ESP32-CAM module (AI-Thinker) | Captures room photos |
| USB-to-serial adapter (or USB cable with CH340) | Flash WiFi config |
| Patient's Android/iPhone | Opens the PWA patient screen |

---

## 1. Install Ollama + Gemma 4

```bash
# macOS
brew install ollama
ollama serve &
ollama pull gemma4:12b
```

Test it's working:
```bash
curl http://localhost:11434/api/generate \
  -d '{"model":"gemma4:12b","prompt":"Hello","stream":false}'
```

---

## 2. Install backend dependencies

```bash
cd /path/to/staysync
npm install
cp .env.example .env
```

Edit `.env`:
```
PORT=3001
OLLAMA_URL=http://localhost:11434
ALLOWED_ORIGIN=*
```

Start the backend:
```bash
node server.js
# → StaySync backend on port 3001
```

Verify:
```bash
curl http://localhost:3001/health
# → {"ok":true,"timestamp":"..."}
```

---

## 3. Expose backend via Cloudflare Tunnel

```bash
# Install (macOS)
brew install cloudflared

# Quick tunnel — no account needed (for demo/hackathon)
cloudflared tunnel --url http://localhost:3001
# Prints: https://abc-xyz.trycloudflare.com
```

Copy that URL — you'll need it for the portal.

---

## 4. Deploy portal to Vercel

```bash
cd portal
npx vercel --prod
```

When prompted:
- Project name: `staysync-portal`
- Framework: `Next.js` (auto-detected)

After deploy, go to **Vercel dashboard → your project → Settings → Environment Variables**, add:

```
NEXT_PUBLIC_API_URL = https://abc-xyz.trycloudflare.com
```

Then redeploy: `npx vercel --prod`

---

## 5. Flash ESP32-CAM via the portal

1. Open the Vercel URL on your **Mac in Chrome** (Web Serial requires Chrome/Edge desktop)
2. Go to **Cameras → Add Camera**
3. Plug ESP32-CAM via USB (you may need a USB-to-serial adapter with CH340 driver)
4. Click **Connect Camera** — Chrome will ask you to pick the serial port
5. Fill in:
   - Camera name (e.g. "Living Room")
   - Room/location
   - WiFi SSID
   - WiFi password
6. Click **Flash & Connect** — credentials are sent to the ESP32 via serial
7. The ESP32 reboots, joins WiFi, registers itself, and starts sending photos every 3s

> **Note:** If Web Serial doesn't appear, flash the `firmware/esp32cam.ino` in Arduino IDE first. The firmware reads the config from serial on boot, so Web Serial flashing sends the JSON after the sketch is already running.

---

## 6. Set up the patient's phone

1. Open the Vercel URL on the patient's phone in **Chrome** (Android) or **Safari** (iPhone)
2. Navigate to `/patient`
3. Add to home screen:
   - **Android Chrome:** Menu → Install App
   - **iPhone Safari:** Share → Add to Home Screen
4. The icon now appears on the home screen like a native app
5. The screen shows guidance and auto-speaks when the camera detects something

---

## 7. Add a patient in the portal

1. Open the Vercel URL on your caregiver phone/browser
2. Go to **Patients → + Add Patient**
3. Fill in name, age, conditions, medications, and daily routine
4. The portal will now use patient context when Gemma 4 generates guidance

---

## 8. Daily operation

Open three terminals:

```bash
# Terminal 1 — AI engine
ollama serve

# Terminal 2 — tunnel (restart if URL changes)
cloudflared tunnel --url http://localhost:3001

# Terminal 3 — backend
node server.js
```

AI reports run automatically:
- **Daily at 11pm** — summarizes the day's events for each patient
- **Sunday at 8pm** — weekly summary with suggestions

To generate a report manually: go to **Patients → [patient] → Performance → Generate AI Report Now**

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Ollama times out | Ensure `ollama serve` is running; try `gemma4:4b` if RAM is limited |
| Camera shows offline | Check ESP32 is on same WiFi; confirm tunnel URL is set correctly |
| Web Serial not visible | Use Chrome 89+ on Mac/Windows desktop; Linux needs `dialout` group |
| No audio on patient phone | Tap the screen once — browsers require a user gesture before speech |
| Tunnel URL changes | Restart `cloudflared`, update Vercel env var, redeploy |

---

## Arduino IDE setup (first-time firmware flash)

1. Install [Arduino IDE 2](https://www.arduino.cc/en/software)
2. File → Preferences → Additional boards URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Tools → Board → Board Manager → search `esp32` → install by Espressif
4. Tools → Manage Libraries → install `ArduinoJson` by Benoit Blanchon
5. Open `firmware/esp32cam.ino`
6. Tools → Board → select `AI Thinker ESP32-CAM`
7. Tools → Port → select your USB port
8. Click Upload (hold BOOT button on ESP32-CAM while uploading if needed)
9. After upload, open Serial Monitor at 115200 baud — you'll see `StaySync ESP32-CAM starting...`
