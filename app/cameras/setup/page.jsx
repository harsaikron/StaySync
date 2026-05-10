'use client';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useRouter } from 'next/navigation';
import BrowserCamera from '@/components/BrowserCamera';
import Icon from '@/components/Icon';

function saveLocalCamera(cam) {
  try {
    const existing = JSON.parse(localStorage.getItem('staysync-local-cameras') || '[]');
    const updated = [...existing.filter(c => c.id !== cam.id), cam];
    localStorage.setItem('staysync-local-cameras', JSON.stringify(updated));
  } catch {}
}

const BAUD_RATE = 115200;
const ENCODER = new TextEncoder();

// Detect the public backend URL at runtime
function getDefaultServerUrl() {
  if (typeof window === 'undefined') return '';
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env && !env.includes('localhost')) return env;
  // Running on Vercel / public domain — user must supply backend URL
  return '';
}

function Field({ label, note, children }) {
  return (
    <div>
      <label className="text-sm block mb-1.5" style={{ color: 'var(--text-muted,#888)' }}>{label}</label>
      {children}
      {note && <p className="text-xs mt-1" style={{ color: 'var(--text-muted,#666)' }}>{note}</p>}
    </div>
  );
}

function InputBox({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl px-4 py-3 text-base outline-none"
      style={{ background: 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#333)', color: 'var(--text,#fff)' }} />
  );
}

const ESP32_SKETCH = `// StaySync ESP32-CAM Firmware
// Flash this first via Arduino IDE, THEN use this page to configure WiFi.
// Board: "AI Thinker ESP32-CAM" | Libraries: ArduinoJson, esp32 board package

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>

#define PWDN_GPIO_NUM  32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM   0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM     5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22

Preferences prefs;
String ssid, password, serverUrl, cameraId;

void setup() {
  Serial.begin(115200);
  delay(1000);

  prefs.begin("staysync", false);
  ssid      = prefs.getString("ssid", "");
  password  = prefs.getString("pass", "");
  serverUrl = prefs.getString("url",  "");
  cameraId  = prefs.getString("cam",  "esp32-cam");

  // Wait 4s for config JSON from StaySync portal
  unsigned long t0 = millis();
  String buf = "";
  while (millis() - t0 < 4000) {
    while (Serial.available()) { buf += (char)Serial.read(); t0 = millis(); }
  }
  if (buf.length() > 2) {
    StaticJsonDocument<512> doc;
    if (!deserializeJson(doc, buf)) {
      ssid      = doc["ssid"]      | ssid;
      password  = doc["password"]  | password;
      serverUrl = doc["server_url"]| serverUrl;
      cameraId  = doc["camera_id"] | cameraId;
      prefs.putString("ssid", ssid);
      prefs.putString("pass", password);
      prefs.putString("url",  serverUrl);
      prefs.putString("cam",  cameraId);
      Serial.println("Config saved!");
    }
  }
  prefs.end();

  camera_config_t cfg;
  cfg.ledc_channel = LEDC_CHANNEL_0; cfg.ledc_timer = LEDC_TIMER_0;
  cfg.pin_d0=Y2_GPIO_NUM; cfg.pin_d1=Y3_GPIO_NUM; cfg.pin_d2=Y4_GPIO_NUM;
  cfg.pin_d3=Y5_GPIO_NUM; cfg.pin_d4=Y6_GPIO_NUM; cfg.pin_d5=Y7_GPIO_NUM;
  cfg.pin_d6=Y8_GPIO_NUM; cfg.pin_d7=Y9_GPIO_NUM;
  cfg.pin_xclk=XCLK_GPIO_NUM; cfg.pin_pclk=PCLK_GPIO_NUM;
  cfg.pin_vsync=VSYNC_GPIO_NUM; cfg.pin_href=HREF_GPIO_NUM;
  cfg.pin_sscb_sda=SIOD_GPIO_NUM; cfg.pin_sscb_scl=SIOC_GPIO_NUM;
  cfg.pin_pwdn=PWDN_GPIO_NUM; cfg.pin_reset=RESET_GPIO_NUM;
  cfg.xclk_freq_hz=20000000; cfg.pixel_format=PIXFORMAT_JPEG;
  cfg.frame_size=FRAMESIZE_VGA; cfg.jpeg_quality=12; cfg.fb_count=1;
  if (esp_camera_init(&cfg) != ESP_OK) { Serial.println("Camera init failed"); return; }

  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("Connecting");
  for (int i=0; i<30 && WiFi.status()!=WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  Serial.println(WiFi.status()==WL_CONNECTED ? "\\nConnected: "+WiFi.localIP().toString() : "\\nFailed");
}

void loop() {
  if (WiFi.status()!=WL_CONNECTED || ssid.isEmpty()) { delay(5000); return; }
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { delay(5000); return; }
  HTTPClient http;
  http.begin(serverUrl+"/upload/"+cameraId);
  http.addHeader("Content-Type","image/jpeg");
  int code = http.POST(fb->buf, fb->len);
  Serial.printf("Upload %d (%d bytes)\\n", code, fb->len);
  http.end();
  esp_camera_fb_return(fb);
  delay(5000);
}`;

function ArduinoSketchSection() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(ESP32_SKETCH).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ background: '#451a03', border: '1px solid #92400e', color: '#fbbf24' }}>
        <Icon name="warning" size={15} color="#fbbf24" />
        Step 0 — Flash Arduino firmware first (required)
      </button>

      {open && (
        <div className="mt-3 rounded-xl overflow-hidden"
          style={{ border: '1px solid #92400e' }}>
          <div className="px-4 py-3 space-y-2" style={{ background: '#1c0a00' }}>
            <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
              Your ESP32-CAM needs this firmware before WiFi config will work.
            </p>
            <div className="space-y-1.5 text-sm" style={{ color: '#d97706' }}>
              <p>① Install <strong>Arduino IDE</strong> and add the ESP32 board package</p>
              <p>② Install library: <span className="font-mono text-white">ArduinoJson</span> (Benoit Blanchon)</p>
              <p>③ Board setting: <span className="font-mono text-white">AI Thinker ESP32-CAM</span></p>
              <p>④ Copy the sketch below → paste into Arduino IDE → Upload</p>
              <p>⑤ Come back here and click "Connect Camera via USB" to send WiFi config</p>
            </div>
          </div>
          <div className="relative" style={{ background: '#0a0a0a', borderTop: '1px solid #333' }}>
            <button onClick={copy}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold z-10"
              style={{ background: copied ? '#166534' : '#1e3a8a', color: copied ? '#4ade80' : '#93c5fd' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre className="p-4 text-xs overflow-x-auto" style={{ color: '#aaa', maxHeight: 260, fontFamily: 'monospace' }}>
              {ESP32_SKETCH}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ESP32Tab() {
  const router = useRouter();
  const [port, setPort] = useState(null);
  const [status, setStatus] = useState('idle');
  const [form, setForm] = useState({
    name: '', location: '', ssid: '', password: '',
    serverUrl: getDefaultServerUrl(),
    camId: `esp32-${Date.now()}`,
  });
  const [log, setLog] = useState([]);
  const addLog = (msg) => setLog(prev => [...prev, msg]);
  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const connectSerial = async () => {
    setStatus('connecting');
    setLog([]);
    addLog('Opening port picker — select your ESP32-CAM…');
    try {
      // Always request a fresh port so the user can pick the right one
      const p = await navigator.serial.requestPort();
      setPort(p);

      // If port is already open from a previous attempt, close it first
      if (p.readable || p.writable) {
        addLog('Port was already open — closing and reopening…');
        try { await p.close(); } catch {}
        await new Promise(r => setTimeout(r, 800));
      }

      await p.open({ baudRate: BAUD_RATE });
      setStatus('connected');
      addLog('USB connected ✓ — fill in the details below and click Flash');
    } catch (err) {
      setStatus('error');
      const isLocked = err.name === 'InvalidStateError' || err.name === 'NetworkError'
        || (err.message || '').toLowerCase().includes('open');
      if (isLocked) {
        addLog('❌ Port is locked by another app');
        addLog('Fix: Close Arduino IDE completely (not just Serial Monitor)');
        addLog('Fix: Unplug the ESP32-CAM USB cable, wait 3 seconds, plug back in');
        addLog('Fix: Then click "Connect Camera via USB" again');
      } else if (err.name === 'NotFoundError') {
        addLog('No port selected — click Connect and choose your ESP32 from the list');
      } else {
        addLog(`❌ ${err.message || 'Could not open port'}`);
        addLog('Fix: Close Arduino IDE, unplug/replug the ESP32-CAM, try again');
      }
    }
  };

  const flashCredentials = async () => {
    if (!port || !form.name || !form.ssid || !form.password || !form.serverUrl) {
      alert('Fill all fields including the backend server URL');
      return;
    }
    try {
      setStatus('flashing');
      addLog('Flashing WiFi + server URL to ESP32-CAM...');
      const writer = port.writable.getWriter();
      const payload = JSON.stringify({
        ssid: form.ssid,
        password: form.password,
        server_url: form.serverUrl.replace(/\/$/, ''),
        camera_id: form.camId,
      }) + '\n';
      await writer.write(ENCODER.encode(payload));
      writer.releaseLock();
      addLog('Credentials sent ✓');
      addLog('Camera will now connect to your WiFi independently...');
      setStatus('waiting');

      // Save locally immediately — no backend needed for this step
      const camData = { id: form.camId, name: form.name, location: form.location || 'room', type: 'esp32', status: 'online' };
      saveLocalCamera(camData);
      addLog(`"${form.name}" saved to portal ✓`);

      // Try backend registration (non-fatal — ESP32 will self-register when online)
      await new Promise(r => setTimeout(r, 3000));
      try {
        await post('/cameras/register', camData);
        addLog('Backend registration ✓');
      } catch {
        addLog('Backend not reachable — camera saved locally (will sync when backend is online)');
      }

      addLog('You can now unplug the USB — camera runs on WiFi/powerbank');
      setStatus('done');
      setTimeout(() => router.push('/cameras'), 3000);
    } catch (err) { setStatus('error'); addLog(`Error: ${err.message}`); }
  };

  const serverUrlMissing = !form.serverUrl || form.serverUrl.includes('localhost');

  return (
    <div className="space-y-4">

      {/* Step 0: Arduino firmware */}
      <ArduinoSketchSection />

      {/* How it works */}
      <div className="rounded-xl p-4 space-y-2"
        style={{ background: 'var(--surface,#111)', border: '1px solid #1e3a5f' }}>
        <p className="text-sm font-semibold" style={{ color: '#93c5fd' }}>How it works</p>
        <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-muted,#888)' }}>
          <div className="flex items-start gap-2">
            <span className="text-blue-400 font-bold shrink-0">1.</span>
            Flash WiFi + backend URL via USB <span className="text-xs">(one-time, desktop only)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400 font-bold shrink-0">2.</span>
            Unplug USB — connect to powerbank
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400 font-bold shrink-0">3.</span>
            Works anywhere on WiFi or phone hotspot — no desktop needed
          </div>
        </div>
      </div>

      {/* USB connection */}
      <div className="rounded-xl p-4 space-y-3"
        style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)' }}>
        <p className="text-base font-semibold" style={{ color: 'var(--text,#fff)' }}>
          Step 1 — Connect via USB
        </p>

        {!('serial' in navigator) ? (
          <div className="rounded-xl p-3 space-y-1"
            style={{ background: '#450a0a', border: '1px solid #7f1d1d' }}>
            <p className="text-sm font-semibold flex items-center gap-2" style={{ color: '#fca5a5' }}>
              <Icon name="warning" size={14} color="#fca5a5" /> Chrome or Edge required
            </p>
            <p className="text-xs" style={{ color: '#f87171' }}>
              Open this page in Chrome or Edge on a desktop/laptop. Safari and Firefox do not support USB serial.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl p-3 space-y-1.5 text-sm"
              style={{ background: '#0f172a', border: '1px solid #1e3a8a', color: '#93c5fd' }}>
              <p className="font-semibold">Before connecting:</p>
              <p>① Close <strong>Arduino IDE completely</strong> (not just Serial Monitor)</p>
              <p>② Plug in the ESP32-CAM USB cable</p>
              <p>③ Click Connect — pick the port that appears (e.g. <span className="font-mono">cu.usbserial</span> on Mac)</p>
            </div>

            {status === 'idle' || status === 'error' ? (
              <button onClick={connectSerial}
                className="w-full py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
                style={{ background: '#2563eb', color: '#ffffff' }}>
                <Icon name="plug" size={18} color="#ffffff" />
                Connect Camera via USB
              </button>
            ) : status === 'connecting' ? (
              <p className="text-sm text-center py-1" style={{ color: '#60a5fa' }}>Connecting…</p>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ color: '#22c55e' }}>
                  <Icon name="check" size={18} color="#22c55e" /> USB Connected
                </div>
                <button onClick={() => { setStatus('idle'); setLog([]); setPort(null); }}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ border: '1px solid var(--border,#333)', color: 'var(--text-muted,#888)' }}>
                  Reset
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Camera details + flash */}
      {['connected', 'flashing', 'waiting', 'done'].includes(status) && (
        <div className="rounded-xl p-4 space-y-4"
          style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)' }}>
          <p className="text-base font-semibold" style={{ color: 'var(--text,#fff)' }}>
            Step 2 — Camera details
          </p>

          <Field label="Camera name" note="">
            <InputBox value={form.name} onChange={set('name')} placeholder="Living Room" />
          </Field>

          <Field label="Room / location">
            <InputBox value={form.location} onChange={set('location')} placeholder="living_room" />
          </Field>

          <Field label="WiFi name (SSID)" note="Your home WiFi or mobile hotspot name">
            <InputBox value={form.ssid} onChange={set('ssid')} placeholder="MyWiFi or iPhone Hotspot" />
          </Field>

          <Field label="WiFi password">
            <InputBox value={form.password} onChange={set('password')} placeholder="••••••••" type="password" />
          </Field>

          <Field
            label="Backend server URL"
            note="This is where the ESP32-CAM sends its video frames. Must be a public URL — not localhost.">
            <InputBox
              value={form.serverUrl}
              onChange={set('serverUrl')}
              placeholder="https://your-backend.railway.app"
            />
            {serverUrlMissing && (
              <div className="mt-2 rounded-lg px-3 py-2.5 text-sm flex items-start gap-2"
                style={{ background: '#431407', border: '1px solid #7c2d12', color: '#fca5a5' }}>
                <Icon name="warning" size={14} color="#fca5a5" />
                <span>Enter your public backend URL. If you use localhost, the camera won't reach the server when on WiFi or hotspot.</span>
              </div>
            )}
          </Field>

          <button onClick={flashCredentials}
            disabled={status !== 'connected' || serverUrlMissing}
            className="w-full py-3.5 rounded-xl text-base font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: '#2563eb', color: '#ffffff' }}>
            <Icon name="plug" size={18} color="#ffffff" />
            Flash & Register Camera
          </button>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="rounded-xl p-4 text-sm space-y-1.5"
          style={{ background: '#0a0a0a', border: '1px solid var(--border,#222)' }}>
          {log.map((l, i) => {
            const isError = l.startsWith('❌') || l.startsWith('Error');
            const isFix   = l.startsWith('Fix:');
            const isOk    = l.includes('✓');
            return (
              <div key={i} className={isFix ? 'pl-3 text-xs' : ''}
                style={{
                  color: isError ? '#f87171' : isFix ? '#fbbf24' : isOk ? '#22c55e' : 'var(--text-muted,#888)',
                  fontFamily: isFix ? 'inherit' : 'monospace',
                }}>
                {l}
              </div>
            );
          })}
        </div>
      )}

      {/* Already flashed path */}
      <AlreadyFlashedSection router={router} />
    </div>
  );
}

function AlreadyFlashedSection({ router }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', camId: '' });
  const [saving, setSaving] = useState(false);

  const register = async () => {
    if (!form.name || !form.camId) { alert('Enter camera name and ID'); return; }
    setSaving(true);
    const camData = { id: form.camId, name: form.name, location: form.location || 'room', type: 'esp32', status: 'online' };
    // Always save locally first
    saveLocalCamera(camData);
    // Try backend (non-fatal)
    try { await post('/cameras/register', camData); } catch {}
    router.push('/cameras');
    setSaving(false);
  };

  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ border: '1px solid var(--border,#333)', color: 'var(--text-muted,#888)' }}>
        <Icon name="check" size={15} color="var(--text-muted,#888)" />
        Already flashed? Register without USB
      </button>

      {open && (
        <div className="mt-3 rounded-xl p-4 space-y-3"
          style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted,#888)' }}>
            If your ESP32-CAM is already flashed and connecting to WiFi, just register it by name.
          </p>
          {[
            { key: 'name',     label: 'Camera name',    placeholder: 'Living Room' },
            { key: 'location', label: 'Room',            placeholder: 'living_room' },
            { key: 'camId',    label: 'Camera ID',       placeholder: 'esp32-livingroom' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-sm block mb-1.5" style={{ color: 'var(--text-muted,#888)' }}>{f.label}</label>
              <input value={form[f.key]} placeholder={f.placeholder}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-base outline-none"
                style={{ background: 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#333)', color: 'var(--text,#fff)' }} />
            </div>
          ))}
          <button onClick={register} disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: '#2563eb', color: '#ffffff' }}>
            {saving ? 'Registering...' : 'Register Camera'}
          </button>
        </div>
      )}
    </div>
  );
}

function DesktopCameraGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ border: '1px solid var(--border,#333)', color: 'var(--text-muted,#888)' }}>
        <Icon name="info" size={15} color="var(--text-muted,#888)" />
        {open ? 'Hide guide' : 'How to connect from another device on the same WiFi'}
      </button>
      {open && (
        <div className="mt-3 rounded-xl p-4 space-y-3"
          style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)' }}>
          <p className="text-sm font-semibold" style={{ color: '#93c5fd' }}>Find your Mac/PC local IP address</p>
          <div className="space-y-2 text-sm" style={{ color: 'var(--text-muted,#aaa)' }}>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-bold shrink-0">Mac:</span>
              <span>System Settings → Wi-Fi → click your network → IP Address (e.g. <span className="font-mono text-white">192.168.1.42</span>)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-bold shrink-0">Mac:</span>
              <span>Or open Terminal and run <span className="font-mono text-white">ipconfig getifaddr en0</span></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-bold shrink-0">Windows:</span>
              <span>Open Command Prompt, run <span className="font-mono text-white">ipconfig</span> → look for IPv4 Address</span>
            </div>
          </div>
          <div className="rounded-lg px-3 py-2.5 text-sm"
            style={{ background: '#0f172a', border: '1px solid #1e3a8a', color: '#93c5fd' }}>
            Then go to <strong>Settings → Backend URL</strong> and enter:<br />
            <span className="font-mono">http://192.168.1.x:3001</span><br />
            (replace x with your actual IP). Both devices must be on the same WiFi.
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted,#666)' }}>
            For remote access outside home WiFi, deploy the backend to Railway, Render, or similar and use the public URL instead.
          </p>
        </div>
      )}
    </div>
  );
}

function MacCameraTab() {
  const router = useRouter();
  const [name, setName] = useState('Webcam');
  const [registered, setRegistered] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 text-sm"
        style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)', color: 'var(--text-muted,#888)' }}>
        Uses your Mac's built-in webcam or any USB camera. Streams frames to Gemma 4 every 3 seconds.
      </div>
      <div>
        <label className="text-sm block mb-1.5" style={{ color: 'var(--text-muted,#888)' }}>Camera name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-base outline-none"
          style={{ background: 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#333)', color: 'var(--text,#fff)' }} />
      </div>
      <BrowserCamera cameraId="browser-mac" cameraName={name} onRegistered={() => setRegistered(true)} compact />
      {registered && (
        <button onClick={() => router.push('/cameras')}
          className="w-full py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
          style={{ border: '1px solid #1d4ed8', color: '#60a5fa' }}>
          Go to Cameras <Icon name="arrow-right" size={16} color="#60a5fa" />
        </button>
      )}
      <DesktopCameraGuide />
    </div>
  );
}

function PhoneCameraTab() {
  const router = useRouter();
  const [name, setName] = useState('Phone Camera');
  const [registered, setRegistered] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 text-sm"
        style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)', color: 'var(--text-muted,#888)' }}>
        Open on your phone in Chrome. Uses the back camera and streams to Gemma 4 every 3 seconds.
      </div>
      <div>
        <label className="text-sm block mb-1.5" style={{ color: 'var(--text-muted,#888)' }}>Camera name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-base outline-none"
          style={{ background: 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#333)', color: 'var(--text,#fff)' }} />
      </div>
      <BrowserCamera cameraId="browser-phone" cameraName={name} onRegistered={() => setRegistered(true)} compact />
      {registered && (
        <button onClick={() => router.push('/cameras')}
          className="w-full py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
          style={{ border: '1px solid #1d4ed8', color: '#60a5fa' }}>
          Go to Cameras <Icon name="arrow-right" size={16} color="#60a5fa" />
        </button>
      )}
    </div>
  );
}

const TABS = [
  { id: 'esp32', icon: 'signal',  label: 'ESP32-CAM', sub: 'Hardware' },
  { id: 'mac',   icon: 'monitor', label: 'Mac/PC',    sub: 'Webcam' },
  { id: 'phone', icon: 'phone',   label: 'Phone',     sub: 'Browser' },
];

export default function CameraSetupPage() {
  const [tab, setTab] = useState('esp32');

  return (
    <div className="min-h-screen p-4 pb-24" style={{ background: 'var(--bg,#000)' }}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text,#fff)' }}>Add Camera</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted,#666)' }}>Choose camera type</p>
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-3 px-1 rounded-xl text-center transition-colors"
            style={{
              background: tab === t.id ? '#2563eb' : 'var(--surface,#111)',
              border: tab === t.id ? '1px solid #2563eb' : '1px solid var(--border,#222)',
              color: tab === t.id ? '#ffffff' : 'var(--text-muted,#666)',
            }}>
            <div className="flex justify-center mb-1">
              <Icon name={t.icon} size={18} color={tab === t.id ? '#ffffff' : 'var(--text-muted,#666)'} />
            </div>
            <div className="text-sm font-medium">{t.label}</div>
            <div className="text-xs opacity-70">{t.sub}</div>
          </button>
        ))}
      </div>

      {tab === 'esp32' && <ESP32Tab />}
      {tab === 'mac'   && <MacCameraTab />}
      {tab === 'phone' && <PhoneCameraTab />}
    </div>
  );
}
