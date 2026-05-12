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
#define SERVER_URL     "http://YOUR_MAC_IP:3001"  // <-- e.g. http://192.168.1.42:3001
#define CAMERA_ID      "esp32-cam-1"          // <-- give this camera a unique name

// ════════════════════════════════════════════════════════
// Board: AI Thinker ESP32-CAM
// IMPORTANT: ESP32-CAM only connects to 2.4 GHz WiFi.
//   If your router broadcasts 5 GHz with the same name,
//   enable a separate 2.4 GHz SSID in your router admin.
//   Or test with an iPhone hotspot (always 2.4 GHz).
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

bool connectWiFi() {
  Serial.println("Connecting to WiFi: " + String(WIFI_SSID));
  WiFi.disconnect(true);   // clear any previous connection
  delay(200);
  WiFi.mode(WIFI_STA);     // station mode only
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40; i++) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\\nConnected! IP: " + WiFi.localIP().toString());
      return true;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nERROR: WiFi failed");
  Serial.println("  Check: 1) WIFI_SSID and WIFI_PASSWORD are correct");
  Serial.println("         2) Your router is broadcasting 2.4 GHz");
  Serial.println("         3) ESP32-CAM is within range of router");
  return false;
}

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

  if (connectWiFi()) {
    Serial.println("Sending frames every 5 seconds...");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost — reconnecting...");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) { delay(5000); return; }
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

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy}
      className="text-xs px-3 py-1.5 rounded-lg font-bold shrink-0"
      style={{ background: copied ? '#16a34a' : '#1d4ed8', color: '#fff' }}>
      {copied ? '✓ Copied' : label}
    </button>
  );
}

function CodeLine({ children }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5"
      style={{ background: '#0f172a', border: '1px solid #1e3a8a' }}>
      <code className="text-xs font-mono flex-1 truncate" style={{ color: '#93c5fd' }}>{children}</code>
      <CopyButton text={children} />
    </div>
  );
}

function Step({ n, color = '#2563eb', title, sub, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#f3f4f6' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: color }}>{n}</div>
        <div>
          <p className="font-semibold text-sm" style={{ color: '#111827' }}>{title}</p>
          {sub && <p className="text-xs" style={{ color: '#9ca3af' }}>{sub}</p>}
        </div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function ESP32Tab() {
  const router = useRouter();
  const [camName, setCamName] = useState('Living Room');
  const [camLocation, setCamLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const registerCamera = async () => {
    if (!camName.trim()) { alert('Enter a camera name'); return; }
    setSaving(true);
    const camData = {
      id: 'esp32-cam-1',
      name: camName.trim(),
      location: camLocation.trim() || 'room',
      type: 'esp32',
      status: 'online',
    };
    saveLocalCamera(camData);
    try { await post('/cameras/register', camData); } catch {}
    router.push('/cameras');
    setSaving(false);
  };

  return (
    <div className="space-y-4">

      {/* Sketch section — open by default */}
      <ArduinoSketchSection />

      {/* Step 1 — Start backend on Mac */}
      <Step n="1" title="Start the backend on your Mac" sub="Run this once in Terminal — leave it running">
        <p className="text-sm" style={{ color: '#374151' }}>
          Open <strong>Terminal</strong> on your Mac and run:
        </p>
        <CodeLine>cd ~/Downloads/staysync && node server.js</CodeLine>
        <p className="text-xs" style={{ color: '#6b7280' }}>
          You should see: <span className="font-mono bg-gray-100 px-1 rounded">StaySync backend on port 3001</span>
        </p>
      </Step>

      {/* Step 2 — Find Mac IP */}
      <Step n="2" title="Find your Mac's IP address" sub="The ESP32 will send frames to this address">
        <p className="text-sm" style={{ color: '#374151' }}>
          In Terminal, run:
        </p>
        <CodeLine>ipconfig getifaddr en0</CodeLine>
        <p className="text-xs" style={{ color: '#6b7280' }}>
          You'll get something like <span className="font-mono bg-gray-100 px-1 rounded">192.168.1.42</span> — copy that number.
          Then in the Arduino sketch, set:
        </p>
        <div className="rounded-lg px-3 py-2.5 text-xs font-mono" style={{ background: '#fef3c7', border: '1px solid #fbbf24', color: '#92400e' }}>
          #define SERVER_URL &nbsp;&nbsp;"http://192.168.1.42:3001"<br/>
          <span style={{ opacity: 0.7 }}>// replace 192.168.1.42 with your actual IP</span>
        </div>
        <div className="rounded-xl px-3 py-2 text-xs flex items-start gap-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
          <span>💡</span>
          <span>Your Mac and ESP32 must be on the <strong>same WiFi network</strong>. ESP32 only supports <strong>2.4 GHz</strong> — if unsure, test with iPhone hotspot first.</span>
        </div>
      </Step>

      {/* Step 3 — Flash sketch */}
      <Step n="3" title="Flash the sketch to ESP32-CAM" sub="Copy from the yellow box above → paste in Arduino IDE">
        <div className="space-y-1.5 text-sm" style={{ color: '#374151' }}>
          <p>① Copy the sketch from the <strong>yellow box above</strong></p>
          <p>② Open Arduino IDE → press <strong>⌘+A</strong> → Delete → paste</p>
          <p>③ Fill in <strong>WIFI_SSID</strong>, <strong>WIFI_PASSWORD</strong>, and <strong>SERVER_URL</strong> (your Mac IP)</p>
          <p>④ Tools → Board → <strong>AI Thinker ESP32-CAM</strong></p>
          <p>⑤ Tools → Port → pick your ESP32 port</p>
          <p>⑥ Hold <strong>IO0 button</strong> → click Upload → release when "Connecting…"</p>
          <p>⑦ Press <strong>EN button</strong> to reboot after upload</p>
        </div>
      </Step>

      {/* Step 4 — Verify in Serial Monitor */}
      <Step n="4" color="#059669" title="Verify in Serial Monitor" sub="Tools → Serial Monitor → 115200 baud">
        <div className="rounded-xl p-3 space-y-1 text-xs font-mono" style={{ background: '#0f172a' }}>
          <p style={{ color: '#4ade80' }}>=== StaySync ESP32-CAM ===</p>
          <p style={{ color: '#93c5fd' }}>Camera OK</p>
          <p style={{ color: '#93c5fd' }}>Connecting to WiFi: StarHub_4594</p>
          <p style={{ color: '#93c5fd' }}>........</p>
          <p style={{ color: '#4ade80' }}>Connected! IP: 192.168.1.55</p>
          <p style={{ color: '#4ade80' }}>Sending frames every 5 seconds...</p>
          <p style={{ color: '#4ade80' }}>Frame sent OK (12345 bytes)</p>
        </div>
        <p className="text-xs" style={{ color: '#6b7280' }}>
          If you see "Frame sent OK" — the ESP32 is working. Frames will appear in the portal automatically.
        </p>
        <div className="rounded-xl px-3 py-2 text-xs flex items-start gap-2" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
          <span>⚠️</span>
          <span>If you see "WiFi failed" — check that <strong>WIFI_SSID and WIFI_PASSWORD</strong> are correct, and that your router broadcasts <strong>2.4 GHz</strong>.</span>
        </div>
      </Step>

      {/* Step 5 — Register in portal */}
      <Step n="5" color="#7c3aed" title="Register camera in portal" sub="Give it a name so it shows up in your camera list">
        <LightField label="Camera name">
          <LightInput value={camName} onChange={setCamName} placeholder="e.g. Living Room" />
        </LightField>
        <LightField label="Room / location (optional)">
          <LightInput value={camLocation} onChange={setCamLocation} placeholder="e.g. living_room" />
        </LightField>
        <button onClick={registerCamera} disabled={saving || !camName.trim()}
          className="w-full py-3.5 rounded-xl text-base font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: '#7c3aed', color: '#ffffff' }}>
          <Icon name="check" size={18} color="#ffffff" />
          {saving ? 'Registering…' : 'Register Camera → Go to Dashboard'}
        </button>
        <p className="text-xs text-center" style={{ color: '#9ca3af' }}>
          Camera ID: <code className="font-mono">esp32-cam-1</code> · frames appear automatically once the sketch is running
        </p>
      </Step>

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
