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

const ESP32_SKETCH = `// ╔══════════════════════════════════════════════════════╗
// ║         StaySync ESP32-CAM — FILL IN BELOW          ║
// ╚══════════════════════════════════════════════════════╝

#define WIFI_SSID      "YOUR_WIFI_NAME"       // <-- change this
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"   // <-- change this
#define SERVER_URL     "https://YOUR-BACKEND.trycloudflare.com"  // <-- change this
#define CAMERA_ID      "esp32-cam-1"          // <-- give this camera a unique name

// ════════════════════════════════════════════════════════
// Board: AI Thinker ESP32-CAM
// Libraries needed: esp32 board package (Espressif)
//   NO extra libraries required!
// ════════════════════════════════════════════════════════

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

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

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n=== StaySync ESP32-CAM ===");
  Serial.println("WiFi: " + String(WIFI_SSID));
  Serial.println("Server: " + String(SERVER_URL));
  Serial.println("Camera ID: " + String(CAMERA_ID));

  camera_config_t cfg;
  cfg.ledc_channel = LEDC_CHANNEL_0; cfg.ledc_timer = LEDC_TIMER_0;
  cfg.pin_d0=Y2_GPIO_NUM; cfg.pin_d1=Y3_GPIO_NUM; cfg.pin_d2=Y4_GPIO_NUM;
  cfg.pin_d3=Y5_GPIO_NUM; cfg.pin_d4=Y6_GPIO_NUM; cfg.pin_d5=Y7_GPIO_NUM;
  cfg.pin_d6=Y8_GPIO_NUM; cfg.pin_d7=Y9_GPIO_NUM;
  cfg.pin_xclk=XCLK_GPIO_NUM; cfg.pin_pclk=PCLK_GPIO_NUM;
  cfg.pin_vsync=VSYNC_GPIO_NUM; cfg.pin_href=HREF_GPIO_NUM;
  cfg.pin_sscb_sda=SIOD_GPIO_NUM; cfg.pin_sscb_scl=SIOC_GPIO_NUM;
  // Note: if you get "no member named pin_sscb_sda" use pin_sda / pin_scl instead (ESP32 lib v3+)
  cfg.pin_pwdn=PWDN_GPIO_NUM; cfg.pin_reset=RESET_GPIO_NUM;
  cfg.xclk_freq_hz=20000000; cfg.pixel_format=PIXFORMAT_JPEG;
  cfg.frame_size=FRAMESIZE_VGA; cfg.jpeg_quality=12; cfg.fb_count=1;

  if (esp_camera_init(&cfg) != ESP_OK) {
    Serial.println("ERROR: Camera init failed — check board selection (AI Thinker ESP32-CAM)");
    return;
  }
  Serial.println("Camera OK");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\nConnected! IP: " + WiFi.localIP().toString());
    Serial.println("Sending frames every 5 seconds...");
  } else {
    Serial.println("\\nERROR: WiFi failed — check WIFI_SSID and WIFI_PASSWORD at top of sketch");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost — reconnecting...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(5000);
    return;
  }
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { Serial.println("Camera capture failed"); delay(3000); return; }
  HTTPClient http;
  String url = String(SERVER_URL) + "/upload/" + String(CAMERA_ID);
  http.begin(url);
  http.addHeader("Content-Type","image/jpeg");
  int code = http.POST(fb->buf, fb->len);
  if (code == 200) {
    Serial.printf("Frame sent OK (%d bytes)\\n", fb->len);
  } else {
    Serial.printf("Upload failed HTTP %d — check SERVER_URL at top of sketch\\n", code);
  }
  http.end();
  esp_camera_fb_return(fb);
  delay(5000);
}`;

function ArduinoSketchSection() {
  const [open, setOpen] = useState(true); // open by default so users see it
  const [copied, setCopied] = useState(false);

  // Read backend URL from localStorage for hint
  const backendUrl = typeof window !== 'undefined'
    ? (localStorage.getItem('staysync-backend-url') || '') : '';

  const copy = () => {
    navigator.clipboard.writeText(ESP32_SKETCH).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #fbbf24' }}>
      {/* Header */}
      <button onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3.5 flex items-center justify-between"
        style={{ background: '#fffbeb' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <div className="text-left">
            <p className="text-sm font-bold" style={{ color: '#92400e' }}>Step 1 — Flash this sketch to your ESP32-CAM</p>
            <p className="text-xs" style={{ color: '#b45309' }}>Fill in your WiFi & URL at the top, then upload via Arduino IDE</p>
          </div>
        </div>
        <span style={{ color: '#b45309' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ background: '#ffffff' }}>
          {/* What to fill in — highlighted box */}
          <div className="mx-4 mt-4 rounded-xl p-4 space-y-3" style={{ background: '#fef3c7', border: '2px solid #fbbf24' }}>
            <p className="text-sm font-bold" style={{ color: '#92400e' }}>✏️ Fill in these 3 values in the sketch before uploading:</p>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-start gap-2">
                <span style={{ color: '#dc2626', fontWeight: 700 }}>1.</span>
                <span style={{ color: '#374151' }}><strong>WIFI_SSID</strong> — your WiFi name (e.g. "StarHub_4594")</span>
              </div>
              <div className="flex items-start gap-2">
                <span style={{ color: '#dc2626', fontWeight: 700 }}>2.</span>
                <span style={{ color: '#374151' }}><strong>WIFI_PASSWORD</strong> — your WiFi password</span>
              </div>
              <div className="flex items-start gap-2">
                <span style={{ color: '#dc2626', fontWeight: 700 }}>3.</span>
                <div style={{ color: '#374151' }}>
                  <strong>SERVER_URL</strong> — your public backend URL
                  {backendUrl && !backendUrl.includes('localhost') && (
                    <div className="mt-1 text-xs px-2 py-1 rounded-lg" style={{ background: '#d1fae5', color: '#065f46' }}>
                      ✓ Your current URL: {backendUrl}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="px-4 py-3 space-y-1.5 text-sm" style={{ color: '#374151' }}>
            <p className="font-semibold text-xs uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>Arduino IDE Steps</p>
            <p>① Open Arduino IDE → paste the sketch below</p>
            <p>② Fill in WiFi name, password, and backend URL at the <strong>top of the sketch</strong></p>
            <p>③ Tools → Board → <strong>AI Thinker ESP32-CAM</strong></p>
            <p>④ Tools → Port → pick your ESP32 port</p>
            <p>⑤ Hold <strong>IO0 button</strong> → click Upload → release IO0 when "Connecting..."</p>
            <p>⑥ Press <strong>EN button</strong> to reboot after upload</p>
            <p>⑦ Open Serial Monitor (115200 baud) to see connection status</p>
          </div>

          {/* Sketch code */}
          <div className="relative mx-4 mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
            <div className="flex items-center justify-between px-4 py-2" style={{ background: '#1e293b' }}>
              <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>staysync_esp32cam.ino</span>
              <button onClick={copy}
                className="px-4 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: copied ? '#16a34a' : '#2563eb', color: '#ffffff' }}>
                {copied ? '✓ Copied!' : '📋 Copy Sketch'}
              </button>
            </div>
            <pre className="p-4 text-xs overflow-x-auto" style={{ color: '#e2e8f0', maxHeight: 300, fontFamily: 'monospace', background: '#0f172a' }}>
              {ESP32_SKETCH}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function LightInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl px-4 py-3 text-base outline-none"
      style={{ background: '#f5f5f5', border: '1px solid #d1d5db', color: '#111827' }} />
  );
}

function LightField({ label, note, children }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5" style={{ color: '#374151' }}>{label}</label>
      {children}
      {note && <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{note}</p>}
    </div>
  );
}

function ESP32Tab() {
  const router = useRouter();
  const [port, setPort] = useState(null);
  const [usbStatus, setUsbStatus] = useState('idle'); // idle | connecting | connected | error
  const [flashStatus, setFlashStatus] = useState('idle'); // idle | flashing | done | error
  const [path, setPath] = useState('new'); // 'new' | 'existing'
  const [log, setLog] = useState([]);
  const addLog = (msg) => setLog(prev => [...prev, msg]);

  const [camId] = useState(`esp32-${Date.now()}`);
  const [form, setForm] = useState({
    name: '', location: '',
    ssid: '', password: '',
    serverUrl: typeof window !== 'undefined'
      ? (localStorage.getItem('staysync-backend-url') || '') : '',
  });
  const [existingForm, setExistingForm] = useState({ name: '', location: '' });
  const [saving, setSaving] = useState(false);

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));
  const setEx = (key) => (val) => setExistingForm(f => ({ ...f, [key]: val }));

  const serverUrlMissing = !form.serverUrl || form.serverUrl.includes('localhost');

  const connectSerial = async () => {
    setUsbStatus('connecting');
    setLog([]);
    addLog('Opening port picker — select your ESP32-CAM…');
    try {
      const p = await navigator.serial.requestPort();
      setPort(p);
      if (p.readable || p.writable) {
        try { await p.close(); } catch {}
        await new Promise(r => setTimeout(r, 800));
      }
      await p.open({ baudRate: BAUD_RATE });
      setUsbStatus('connected');
      addLog('USB connected ✓ — click "Flash to Camera" below');
    } catch (err) {
      setUsbStatus('error');
      const isLocked = err.name === 'InvalidStateError' || err.name === 'NetworkError'
        || (err.message || '').toLowerCase().includes('open');
      if (isLocked) {
        addLog('❌ Port locked — close Arduino IDE completely, unplug/replug, try again');
      } else if (err.name === 'NotFoundError') {
        addLog('No port selected — click Connect and choose your ESP32 from the list');
      } else {
        addLog(`❌ ${err.message || 'Could not open port'}`);
      }
    }
  };

  const flashCredentials = async () => {
    if (!form.name || !form.ssid || !form.password || !form.serverUrl) {
      alert('Please fill in all fields above before flashing');
      return;
    }
    try {
      setFlashStatus('flashing');
      addLog('Sending WiFi + server config to ESP32-CAM…');
      const writer = port.writable.getWriter();
      const payload = JSON.stringify({
        ssid: form.ssid,
        password: form.password,
        server_url: form.serverUrl.replace(/\/$/, ''),
        camera_id: camId,
      }) + '\n';
      await writer.write(ENCODER.encode(payload));
      writer.releaseLock();
      addLog('Config sent ✓ — saving camera to portal…');

      const camData = { id: camId, name: form.name, location: form.location || 'room', type: 'esp32', status: 'online' };
      saveLocalCamera(camData);
      addLog(`"${form.name}" saved ✓`);

      await new Promise(r => setTimeout(r, 3000));
      try { await post('/cameras/register', camData); addLog('Backend registered ✓'); }
      catch { addLog('Saved locally — will sync when backend is online'); }

      addLog('✅ Done! Unplug USB and connect to a powerbank — frames will appear automatically.');
      setFlashStatus('done');
      setTimeout(() => router.push('/cameras'), 3000);
    } catch (err) {
      setFlashStatus('error');
      addLog(`❌ Error: ${err.message}`);
    }
  };

  const registerExisting = async () => {
    if (!existingForm.name) { alert('Enter a camera name'); return; }
    setSaving(true);
    const id = `esp32-${Date.now()}`;
    const camData = { id, name: existingForm.name, location: existingForm.location || 'room', type: 'esp32', status: 'online' };
    saveLocalCamera(camData);
    try { await post('/cameras/register', camData); } catch {}
    router.push('/cameras');
    setSaving(false);
  };

  return (
    <div className="space-y-4">

      {/* Firmware step — collapsed by default */}
      <ArduinoSketchSection />

      {/* Path selector */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
        <div className="flex">
          {[
            { id: 'new',      label: '🔧 First time setup',    sub: 'Flash WiFi via USB' },
            { id: 'existing', label: '✅ Already configured',   sub: 'Just register the camera' },
          ].map(p => (
            <button key={p.id} onClick={() => setPath(p.id)}
              className="flex-1 py-3 px-2 text-center transition-all"
              style={{
                background: path === p.id ? '#2563eb' : '#f9fafb',
                color: path === p.id ? '#ffffff' : '#6b7280',
                borderRight: p.id === 'new' ? '1px solid #e5e7eb' : 'none',
              }}>
              <div className="text-sm font-semibold">{p.label}</div>
              <div className="text-xs opacity-80 mt-0.5">{p.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── PATH A: First time setup ── */}
      {path === 'new' && (
        <div className="space-y-4">

          {/* Step 1: Camera details */}
          <div className="rounded-2xl p-4 space-y-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: '#2563eb' }}>1</div>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#111827' }}>Camera details</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>Give this camera a name and enter your WiFi</p>
              </div>
            </div>

            <LightField label="Camera name">
              <LightInput value={form.name} onChange={set('name')} placeholder="e.g. Living Room" />
            </LightField>

            <LightField label="Room (optional)">
              <LightInput value={form.location} onChange={set('location')} placeholder="e.g. living_room" />
            </LightField>

            <LightField label="WiFi name" note="Your home WiFi or phone hotspot name">
              <LightInput value={form.ssid} onChange={set('ssid')} placeholder="e.g. MyHomeWiFi" />
            </LightField>

            <LightField label="WiFi password">
              <LightInput value={form.password} onChange={set('password')} placeholder="••••••••" type="password" />
            </LightField>

            <LightField label="Backend URL" note="Public URL where the camera sends frames — not localhost">
              <LightInput value={form.serverUrl} onChange={set('serverUrl')} placeholder="https://your-tunnel.trycloudflare.com" />
              {serverUrlMissing && form.serverUrl !== '' && (
                <div className="mt-2 rounded-xl px-3 py-2 text-xs flex items-center gap-2" style={{ background: '#fef3c7', color: '#92400e' }}>
                  ⚠️ Must be a public URL (not localhost) so the ESP32 can reach it over WiFi
                </div>
              )}
              {!form.serverUrl && (
                <div className="mt-2 rounded-xl px-3 py-2 text-xs flex items-center gap-2" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                  💡 Go to Settings first to set your backend URL — it will be pre-filled here
                </div>
              )}
            </LightField>
          </div>

          {/* Step 2: Connect USB */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: usbStatus === 'connected' ? '#16a34a' : '#2563eb' }}>2</div>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#111827' }}>Connect ESP32 via USB</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>Close Arduino IDE first, then plug in USB</p>
              </div>
            </div>

            {!('serial' in navigator) ? (
              <div className="rounded-xl p-3 text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                ⚠️ <strong>Chrome or Edge required</strong> — open this page on a desktop browser (not Safari/Firefox)
              </div>
            ) : usbStatus === 'connected' ? (
              <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <span className="text-sm font-medium" style={{ color: '#15803d' }}>✅ USB connected</span>
                <button onClick={() => { setUsbStatus('idle'); setLog([]); setPort(null); }}
                  className="text-xs px-3 py-1 rounded-lg" style={{ background: '#e5e7eb', color: '#6b7280' }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={connectSerial} disabled={usbStatus === 'connecting'}
                className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#2563eb', color: '#ffffff' }}>
                <Icon name="plug" size={16} color="#ffffff" />
                {usbStatus === 'connecting' ? 'Opening port picker…' : 'Connect Camera via USB'}
              </button>
            )}
          </div>

          {/* Step 3: Flash */}
          {usbStatus === 'connected' && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: flashStatus === 'done' ? '#16a34a' : '#2563eb' }}>3</div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#111827' }}>Flash & register</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Sends WiFi config to camera and saves it to the portal</p>
                </div>
              </div>

              <button onClick={flashCredentials}
                disabled={flashStatus === 'flashing' || flashStatus === 'done' || serverUrlMissing || !form.name || !form.ssid || !form.password}
                className="w-full py-3.5 rounded-xl text-base font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: flashStatus === 'done' ? '#16a34a' : '#2563eb', color: '#ffffff' }}>
                <Icon name="plug" size={18} color="#ffffff" />
                {flashStatus === 'flashing' ? 'Flashing…' : flashStatus === 'done' ? '✅ Done! Redirecting…' : 'Flash to Camera'}
              </button>
            </div>
          )}

          {/* Log output */}
          {log.length > 0 && (
            <div className="rounded-xl p-4 space-y-1.5" style={{ background: '#0f172a', border: '1px solid #1e3a8a' }}>
              {log.map((l, i) => {
                const isErr = l.startsWith('❌') || l.startsWith('Error');
                const isOk  = l.includes('✓') || l.startsWith('✅');
                return (
                  <div key={i} className="text-xs font-mono"
                    style={{ color: isErr ? '#f87171' : isOk ? '#4ade80' : '#93c5fd' }}>
                    {l}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PATH B: Already configured ── */}
      {path === 'existing' && (
        <div className="rounded-2xl p-4 space-y-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Your ESP32 is already sending frames. Just give it a name so it appears in your portal.
          </p>

          <LightField label="Camera name">
            <LightInput value={existingForm.name} onChange={setEx('name')} placeholder="e.g. Living Room" />
          </LightField>

          <LightField label="Room (optional)">
            <LightInput value={existingForm.location} onChange={setEx('location')} placeholder="e.g. living_room" />
          </LightField>

          <div className="rounded-xl px-4 py-3 text-xs" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
            💡 A unique Camera ID will be auto-generated. You don't need to type one.
          </div>

          <button onClick={registerExisting} disabled={saving || !existingForm.name}
            className="w-full py-3.5 rounded-xl text-base font-semibold disabled:opacity-40"
            style={{ background: '#2563eb', color: '#ffffff' }}>
            {saving ? 'Registering…' : 'Register Camera'}
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
        style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
        Uses your Mac's built-in webcam or any USB camera. Streams frames to Gemma 4 every 3 seconds.
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5" style={{ color: '#374151' }}>Camera name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-base outline-none"
          style={{ background: '#f5f5f5', border: '1px solid #d1d5db', color: '#111827' }} />
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
        style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
        Open on your phone in Chrome. Uses the back camera and streams to Gemma 4 every 3 seconds.
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5" style={{ color: '#374151' }}>Camera name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-base outline-none"
          style={{ background: '#f5f5f5', border: '1px solid #d1d5db', color: '#111827' }} />
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
    <div className="min-h-screen p-4 pb-24" style={{ background: '#f5f5f5' }}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Add Camera</h1>
        <p className="text-sm" style={{ color: '#6b7280' }}>Choose camera type</p>
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-3 px-1 rounded-xl text-center transition-colors"
            style={{
              background: tab === t.id ? '#2563eb' : '#ffffff',
              border: tab === t.id ? '1px solid #2563eb' : '1px solid #e5e7eb',
              color: tab === t.id ? '#ffffff' : '#6b7280',
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
