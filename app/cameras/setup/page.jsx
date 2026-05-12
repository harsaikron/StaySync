'use client';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useRouter } from 'next/navigation';
import BrowserCamera from '@/components/BrowserCamera';
import Icon from '@/components/Icon';

/* ── helpers ─────────────────────────────────────────────── */
function saveLocalCamera(cam) {
  try {
    const existing = JSON.parse(localStorage.getItem('staysync-local-cameras') || '[]');
    localStorage.setItem('staysync-local-cameras', JSON.stringify([...existing.filter(c => c.id !== cam.id), cam]));
  } catch {}
}

function CopyBtn({ text, label = 'Copy' }) {
  const [ok, setOk] = useState(false);
  const go = () => navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); });
  return (
    <button onClick={go}
      className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
      style={{ background: ok ? '#16a34a' : '#2563eb', color: '#fff' }}>
      {ok ? '✓ Copied' : label}
    </button>
  );
}

function Terminal({ children }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: '#0f172a', border: '1px solid #334155' }}>
      <span className="text-green-400 text-xs font-bold shrink-0">$</span>
      <code className="text-xs font-mono flex-1 truncate" style={{ color: '#93c5fd' }}>{children}</code>
      <CopyBtn text={children} />
    </div>
  );
}

function LightInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl px-4 py-3 text-sm outline-none"
      style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#111827' }} />
  );
}

/* ── Arduino sketch ──────────────────────────────────────── */
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
  WiFi.disconnect(true);
  delay(200);
  WiFi.mode(WIFI_STA);
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
  cfg.pin_pwdn=PWDN_GPIO_NUM; cfg.pin_reset=RESET_GPIO_NUM;
  cfg.xclk_freq_hz=20000000; cfg.pixel_format=PIXFORMAT_JPEG;
  cfg.frame_size=FRAMESIZE_VGA; cfg.jpeg_quality=12; cfg.fb_count=1;

  if (esp_camera_init(&cfg) != ESP_OK) {
    Serial.println("ERROR: Camera init failed — check board (AI Thinker ESP32-CAM)");
    return;
  }
  Serial.println("Camera OK");
  if (connectWiFi()) Serial.println("Sending frames every 5 seconds...");
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
    Serial.printf("Upload failed HTTP %d — check SERVER_URL\\n", code);
  }
  http.end();
  esp_camera_fb_return(fb);
  delay(5000);
}`;

/* ── Sketch card ─────────────────────────────────────────── */
function SketchCard() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(ESP32_SKETCH).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #fbbf24', boxShadow: '0 2px 8px rgba(251,191,36,0.12)' }}>
      {/* trigger */}
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-4"
        style={{ background: 'linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#f59e0b', boxShadow: '0 2px 6px rgba(245,158,11,0.35)' }}>
          <span className="text-white text-base">📋</span>
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold" style={{ color: '#78350f' }}>Arduino Sketch — copy & paste into IDE</p>
          <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Fill in 3 values at the top, then upload</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); copy(); }}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: copied ? '#16a34a' : '#d97706', color: '#fff' }}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
          <span style={{ color: '#b45309', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* what to fill */}
      {open && (
        <div style={{ background: '#fff' }}>
          <div className="mx-4 mt-4 rounded-xl p-4 space-y-2.5"
            style={{ background: '#fef9ec', border: '1.5px dashed #fbbf24' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#92400e' }}>✏️ Change only these 3 lines before uploading</p>
            {[
              { n: 1, key: 'WIFI_SSID',     eg: '"StarHub_4594"',           note: 'Your WiFi network name' },
              { n: 2, key: 'WIFI_PASSWORD', eg: '"your-password"',           note: 'Your WiFi password' },
              { n: 3, key: 'SERVER_URL',    eg: '"http://192.168.1.42:3001"', note: 'Your Mac\'s local IP (see Step 2 below)' },
            ].map(r => (
              <div key={r.n} className="flex items-start gap-3 rounded-lg p-2.5"
                style={{ background: '#fff', border: '1px solid #fde68a' }}>
                <span className="w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center shrink-0"
                  style={{ background: '#f59e0b' }}>{r.n}</span>
                <div className="min-w-0">
                  <code className="text-xs font-bold" style={{ color: '#dc2626' }}>{r.key}</code>
                  <code className="text-xs ml-2" style={{ color: '#374151' }}>= {r.eg}</code>
                  <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{r.note}</p>
                </div>
              </div>
            ))}
          </div>

          {/* code block */}
          <div className="mx-4 mb-4 mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#1e293b' }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-xs font-mono ml-2" style={{ color: '#64748b' }}>staysync_esp32cam.ino</span>
              </div>
              <button onClick={copy}
                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: copied ? '#16a34a' : '#2563eb', color: '#fff' }}>
                {copied ? '✓ Copied!' : '📋 Copy All'}
              </button>
            </div>
            <pre className="p-4 text-xs overflow-x-auto overflow-y-auto leading-relaxed"
              style={{ color: '#e2e8f0', maxHeight: 280, fontFamily: 'monospace', background: '#0f172a' }}>
              {ESP32_SKETCH}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step card ───────────────────────────────────────────── */
function StepCard({ n, total, icon, color, bg, title, subtitle, done, children }) {
  const isLast = n === total;
  return (
    <div className="flex gap-3">
      {/* timeline */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 32 }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: done ? '#16a34a' : color, boxShadow: `0 2px 8px ${color}44` }}>
          {done ? '✓' : n}
        </div>
        {!isLast && <div className="w-0.5 flex-1 mt-1" style={{ background: '#e2e8f0', minHeight: 20 }} />}
      </div>

      {/* card */}
      <div className="flex-1 pb-4">
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: `1.5px solid ${done ? '#bbf7d0' : '#e2e8f0'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b"
            style={{ background: bg, borderColor: '#f1f5f9' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: color, boxShadow: `0 2px 6px ${color}44` }}>
              <Icon name={icon} size={15} color="#fff" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: '#0f172a' }}>{title}</p>
              {subtitle && <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{subtitle}</p>}
            </div>
            {done && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#dcfce7', color: '#16a34a' }}>Done ✓</span>
            )}
          </div>
          <div className="p-4 space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ── ESP32 tab ───────────────────────────────────────────── */
function ESP32Tab() {
  const router = useRouter();
  const [camName, setCamName] = useState('Living Room');
  const [camLocation, setCamLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0); // track progress 0..5

  const advance = (n) => setStep(s => Math.max(s, n));

  const registerCamera = async () => {
    if (!camName.trim()) { alert('Enter a camera name'); return; }
    setSaving(true);
    const camData = { id: 'esp32-cam-1', name: camName.trim(), location: camLocation.trim() || 'room', type: 'esp32', status: 'online' };
    saveLocalCamera(camData);
    try { await post('/cameras/register', camData); } catch {}
    router.push('/cameras');
    setSaving(false);
  };

  return (
    <div className="space-y-0">

      {/* Sketch card — full width, outside timeline */}
      <div className="mb-5">
        <SketchCard />
      </div>

      <p className="text-xs font-bold uppercase tracking-widest mb-4 px-1" style={{ color: '#94a3b8' }}>
        Setup Steps
      </p>

      {/* Step 1 */}
      <StepCard n={1} total={5} icon="monitor" color="#2563eb" bg="#f0f7ff" title="Start the backend on your Mac" subtitle="Run once in Terminal — keep it running" done={step >= 1}>
        <p className="text-sm" style={{ color: '#374151' }}>
          Open <strong>Terminal</strong> on your Mac and run:
        </p>
        <Terminal>cd ~/Downloads/staysync && node server.js</Terminal>
        <div className="rounded-xl p-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p className="text-xs font-mono" style={{ color: '#166534' }}>
            ✓ Expected output: <strong>StaySync backend on port 3001</strong>
          </p>
        </div>
        <button onClick={() => advance(1)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ background: step >= 1 ? '#dcfce7' : '#eff6ff', color: step >= 1 ? '#16a34a' : '#2563eb', border: `1px solid ${step >= 1 ? '#bbf7d0' : '#bfdbfe'}` }}>
          {step >= 1 ? '✓ Backend is running' : 'Mark as done →'}
        </button>
      </StepCard>

      {/* Step 2 */}
      <StepCard n={2} total={5} icon="wifi" color="#7c3aed" bg="#faf5ff" title="Find your Mac's IP address" subtitle="The ESP32 will send frames to this IP" done={step >= 2}>
        <p className="text-sm" style={{ color: '#374151' }}>In Terminal, run:</p>
        <Terminal>ipconfig getifaddr en0</Terminal>
        <div className="rounded-xl p-3 space-y-2" style={{ background: '#fef3c7', border: '1px solid #fbbf24' }}>
          <p className="text-xs font-bold" style={{ color: '#92400e' }}>You'll get something like:</p>
          <code className="text-sm font-bold font-mono" style={{ color: '#dc2626' }}>192.168.1.42</code>
          <p className="text-xs" style={{ color: '#78350f' }}>
            Use this in the sketch: <code className="font-mono">SERVER_URL = "http://192.168.1.42:3001"</code>
          </p>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <span className="text-blue-500 text-sm shrink-0">💡</span>
          <p className="text-xs" style={{ color: '#1e40af' }}>
            Mac and ESP32 must be on the <strong>same WiFi</strong>. ESP32 is <strong>2.4 GHz only</strong> — if unsure, test with iPhone hotspot first.
          </p>
        </div>
        <button onClick={() => advance(2)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ background: step >= 2 ? '#dcfce7' : '#faf5ff', color: step >= 2 ? '#16a34a' : '#7c3aed', border: `1px solid ${step >= 2 ? '#bbf7d0' : '#ddd6fe'}` }}>
          {step >= 2 ? '✓ Got my IP' : 'Mark as done →'}
        </button>
      </StepCard>

      {/* Step 3 */}
      <StepCard n={3} total={5} icon="upload" color="#d97706" bg="#fffbeb" title="Flash sketch to ESP32-CAM" subtitle="Copy sketch above → paste in Arduino IDE → upload" done={step >= 3}>
        <div className="space-y-2">
          {[
            { icon: '📋', text: 'Copy the sketch using the button above' },
            { icon: '🖥', text: <>Open Arduino IDE → press <strong>⌘A</strong> → Delete → paste</> },
            { icon: '✏️', text: <>Fill in <code className="font-mono bg-amber-50 px-1 rounded text-xs">WIFI_SSID</code>, <code className="font-mono bg-amber-50 px-1 rounded text-xs">WIFI_PASSWORD</code>, and <code className="font-mono bg-amber-50 px-1 rounded text-xs">SERVER_URL</code></> },
            { icon: '⚙️', text: <>Tools → Board → <strong>AI Thinker ESP32-CAM</strong></> },
            { icon: '🔌', text: <>Tools → Port → pick your <strong>ESP32 USB port</strong></> },
            { icon: '⬆️', text: <>Hold <strong>IO0 button</strong> → click <strong>Upload</strong> → release when "Connecting…" appears</> },
            { icon: '🔄', text: <>Press <strong>EN button</strong> to reboot after upload finishes</> },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5"
              style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <span className="text-base shrink-0">{s.icon}</span>
              <span className="text-sm" style={{ color: '#374151' }}>{s.text}</span>
            </div>
          ))}
        </div>
        <button onClick={() => advance(3)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ background: step >= 3 ? '#dcfce7' : '#fffbeb', color: step >= 3 ? '#16a34a' : '#d97706', border: `1px solid ${step >= 3 ? '#bbf7d0' : '#fcd34d'}` }}>
          {step >= 3 ? '✓ Sketch uploaded' : 'Mark as done →'}
        </button>
      </StepCard>

      {/* Step 4 */}
      <StepCard n={4} total={5} icon="check" color="#059669" bg="#f0fdf4" title="Verify in Serial Monitor" subtitle="Tools → Serial Monitor → set baud to 115200" done={step >= 4}>
        <p className="text-sm" style={{ color: '#374151' }}>After rebooting, you should see this in Serial Monitor:</p>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
          <div className="px-3 py-2 flex items-center gap-2" style={{ background: '#1e293b' }}>
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-mono" style={{ color: '#64748b' }}>Serial Monitor — 115200 baud</span>
          </div>
          <div className="p-3 space-y-0.5 font-mono text-xs" style={{ background: '#0f172a' }}>
            <p style={{ color: '#94a3b8' }}>=== StaySync ESP32-CAM ===</p>
            <p style={{ color: '#60a5fa' }}>Camera OK</p>
            <p style={{ color: '#60a5fa' }}>Connecting to WiFi: StarHub_4594</p>
            <p style={{ color: '#60a5fa' }}>........</p>
            <p style={{ color: '#4ade80' }}>Connected! IP: 192.168.1.55</p>
            <p style={{ color: '#4ade80' }}>Sending frames every 5 seconds...</p>
            <p style={{ color: '#4ade80' }}>Frame sent OK (14823 bytes)</p>
            <p style={{ color: '#4ade80' }}>Frame sent OK (15012 bytes)</p>
          </div>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <span className="text-sm shrink-0">⚠️</span>
          <p className="text-xs" style={{ color: '#dc2626' }}>
            If you see <strong>"WiFi failed"</strong> → double-check <code className="font-mono">WIFI_SSID</code> and <code className="font-mono">WIFI_PASSWORD</code>, and confirm your router is broadcasting <strong>2.4 GHz</strong>.
          </p>
        </div>
        <button onClick={() => advance(4)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ background: step >= 4 ? '#dcfce7' : '#f0fdf4', color: step >= 4 ? '#16a34a' : '#059669', border: `1px solid ${step >= 4 ? '#bbf7d0' : '#6ee7b7'}` }}>
          {step >= 4 ? '✓ Frames sending OK' : 'Mark as done →'}
        </button>
      </StepCard>

      {/* Step 5 */}
      <StepCard n={5} total={5} icon="camera" color="#dc2626" bg="#fff5f5" title="Register camera in portal" subtitle="Give it a name — frames will appear automatically" done={step >= 5}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: '#374151' }}>Camera name</label>
            <LightInput value={camName} onChange={setCamName} placeholder="e.g. Living Room" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: '#374151' }}>Location (optional)</label>
            <LightInput value={camLocation} onChange={setCamLocation} placeholder="e.g. bedroom, hallway" />
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="text-xs" style={{ color: '#64748b' }}>
              Camera ID: <code className="font-mono font-bold" style={{ color: '#0f172a' }}>esp32-cam-1</code>
              <span className="mx-1.5">·</span>
              Frames appear here automatically once "Frame sent OK" appears in Serial Monitor
            </p>
          </div>
          <button onClick={registerCamera} disabled={saving || !camName.trim()}
            className="w-full py-3.5 rounded-xl text-base font-bold disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)', color: '#fff', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
            <Icon name="check" size={18} color="#fff" />
            {saving ? 'Registering…' : 'Register Camera'}
          </button>
        </div>
      </StepCard>

    </div>
  );
}

/* ── Mac / webcam tab ────────────────────────────────────── */
function MacCameraTab() {
  const router = useRouter();
  const [name, setName] = useState('Webcam');
  const [registered, setRegistered] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1.5px solid #bfdbfe' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#2563eb', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
          <Icon name="monitor" size={18} color="#fff" />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: '#1e3a8a' }}>Mac / PC Webcam</p>
          <p className="text-sm mt-0.5" style={{ color: '#3b82f6' }}>
            Uses your Mac's built-in webcam or any USB camera. Streams frames to Gemma 4 every 3 seconds.
          </p>
        </div>
      </div>

      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: '#fff', border: '1.5px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <label className="text-xs font-bold uppercase tracking-wide block" style={{ color: '#374151' }}>Camera name</label>
        <LightInput value={name} onChange={setName} placeholder="e.g. Desk Camera" />
        <BrowserCamera cameraId="browser-mac" cameraName={name} onRegistered={() => setRegistered(true)} compact />
        {registered && (
          <button onClick={() => router.push('/cameras')}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: '#2563eb', color: '#fff' }}>
            View Camera Feed <Icon name="arrow-right" size={16} color="#fff" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Phone camera tab ────────────────────────────────────── */
function PhoneCameraTab() {
  const router = useRouter();
  const [name, setName] = useState('Phone Camera');
  const [registered, setRegistered] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1.5px solid #bbf7d0' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#059669', boxShadow: '0 2px 8px rgba(5,150,105,0.3)' }}>
          <Icon name="phone" size={18} color="#fff" />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: '#064e3b' }}>Phone Browser Camera</p>
          <p className="text-sm mt-0.5" style={{ color: '#059669' }}>
            Open this page on your phone in Chrome. Uses back camera and streams to Gemma 4 every 3 seconds.
          </p>
        </div>
      </div>

      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: '#fff', border: '1.5px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <label className="text-xs font-bold uppercase tracking-wide block" style={{ color: '#374151' }}>Camera name</label>
        <LightInput value={name} onChange={setName} placeholder="e.g. Patient's Room" />
        <BrowserCamera cameraId="browser-phone" cameraName={name} onRegistered={() => setRegistered(true)} compact />
        {registered && (
          <button onClick={() => router.push('/cameras')}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: '#059669', color: '#fff' }}>
            View Camera Feed <Icon name="arrow-right" size={16} color="#fff" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
const TABS = [
  { id: 'esp32', icon: 'signal',  label: 'ESP32-CAM', sub: 'Hardware',  color: '#2563eb', activeBg: '#2563eb' },
  { id: 'mac',   icon: 'monitor', label: 'Mac / PC',  sub: 'Webcam',    color: '#7c3aed', activeBg: '#7c3aed' },
  { id: 'phone', icon: 'phone',   label: 'Phone',     sub: 'Browser',   color: '#059669', activeBg: '#059669' },
];

export default function CameraSetupPage() {
  const router = useRouter();
  const [tab, setTab] = useState('esp32');
  const active = TABS.find(t => t.id === tab);

  return (
    <div className="min-h-screen pb-24" style={{ background: '#f1f5f9' }}>

      {/* ── Hero header ── */}
      <div className="px-4 pt-4 pb-5"
        style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)' }}>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <Icon name="arrow-right" size={16} color="#94a3b8" style={{ transform: 'rotate(180deg)', display: 'block' }} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Add Camera</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>Choose your camera type to get started</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-3 gap-2">
          {TABS.map(t => {
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="rounded-2xl py-3.5 px-2 flex flex-col items-center gap-1.5 transition-all"
                style={{
                  background: isActive ? t.activeBg : 'rgba(255,255,255,0.05)',
                  border: isActive ? `1.5px solid ${t.color}` : '1.5px solid rgba(255,255,255,0.08)',
                  boxShadow: isActive ? `0 4px 14px ${t.color}44` : 'none',
                }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)' }}>
                  <Icon name={t.icon} size={18} color={isActive ? '#fff' : '#64748b'} />
                </div>
                <span className="text-xs font-bold" style={{ color: isActive ? '#fff' : '#64748b' }}>{t.label}</span>
                <span className="text-xs" style={{ color: isActive ? 'rgba(255,255,255,0.65)' : '#475569' }}>{t.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-4">
        {tab === 'esp32' && <ESP32Tab />}
        {tab === 'mac'   && <MacCameraTab />}
        {tab === 'phone' && <PhoneCameraTab />}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
