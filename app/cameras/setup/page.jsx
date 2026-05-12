'use client';
import { useState, useRef, useEffect } from 'react';
import { post } from '@/lib/api';
import { useRouter } from 'next/navigation';
import BrowserCamera from '@/components/BrowserCamera';
import Icon from '@/components/Icon';

/* ── helpers ─────────────────────────────────────────────── */
function saveLocalCamera(cam) {
  try {
    const existing = JSON.parse(localStorage.getItem('staysync-local-cameras') || '[]');
    localStorage.setItem('staysync-local-cameras',
      JSON.stringify([...existing.filter(c => c.id !== cam.id), cam]));
  } catch {}
}

/* ── Arduino sketch ──────────────────────────────────────── */
const SKETCH = `// ╔══════════════════════════════════════════════════════╗
// ║         StaySync ESP32-CAM  —  fill in below         ║
// ╚══════════════════════════════════════════════════════╝
#define WIFI_SSID      "YOUR_WIFI_NAME"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"
#define SERVER_URL     "http://YOUR_MAC_IP:3001"  // run: ipconfig getifaddr en0
#define CAMERA_ID      "esp32-cam-1"

// Board : AI Thinker ESP32-CAM  |  No extra libraries needed
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
  Serial.println("Connecting: " + String(WIFI_SSID));
  WiFi.disconnect(true); delay(200);
  WiFi.mode(WIFI_STA);   delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40; i++) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Connected! IP: " + WiFi.localIP().toString());
      return true;
    }
    delay(500); Serial.print(".");
  }
  Serial.println("\\nERROR: WiFi failed - check SSID/password and 2.4GHz band");
  return false;
}

void setup() {
  Serial.begin(115200); delay(1000);
  Serial.println("\\n=== StaySync ESP32-CAM ===");
  Serial.println("WiFi: "     + String(WIFI_SSID));
  Serial.println("Server: "   + String(SERVER_URL));
  Serial.println("Camera ID: "+ String(CAMERA_ID));

  camera_config_t cfg;
  cfg.ledc_channel=LEDC_CHANNEL_0; cfg.ledc_timer=LEDC_TIMER_0;
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
    Serial.println("ERROR: Camera init failed"); return;
  }
  Serial.println("Camera OK");
  if (connectWiFi()) Serial.println("Sending frames every 5s...");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) { connectWiFi(); delay(5000); return; }
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { delay(3000); return; }
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/upload/" + String(CAMERA_ID));
  http.addHeader("Content-Type","image/jpeg");
  int code = http.POST(fb->buf, fb->len);
  Serial.printf(code==200 ? "Frame sent OK (%d bytes)\\n" : "Upload failed HTTP %d\\n",
                code==200 ? fb->len : code);
  http.end();
  esp_camera_fb_return(fb);
  delay(5000);
}`;

/* ── Sketch card ─────────────────────────────────────────── */
function SketchCard() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(SKETCH)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: '1.5px solid #fbbf24', boxShadow: '0 2px 8px rgba(251,191,36,.1)' }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5"
        style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#f59e0b' }}>
          <span className="text-white text-sm">⚡</span>
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold" style={{ color: '#78350f' }}>Arduino Sketch</p>
          <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
            Paste into Arduino IDE — fill in WiFi + Mac IP — upload
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); copy(); }}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: copied ? '#16a34a' : '#d97706', color: '#fff' }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <span style={{ color: '#b45309', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div style={{ background: '#fff' }}>
          {/* 3 values to fill */}
          <div className="mx-4 mt-3 rounded-xl p-3 space-y-2"
            style={{ background: '#fef9ec', border: '1.5px dashed #fbbf24' }}>
            <p className="text-xs font-bold" style={{ color: '#92400e' }}>
              ✏️ Change only these 3 lines before uploading:
            </p>
            {[
              { n: 1, key: 'WIFI_SSID',     hint: 'Your WiFi name (2.4 GHz only)' },
              { n: 2, key: 'WIFI_PASSWORD', hint: 'Your WiFi password' },
              { n: 3, key: 'SERVER_URL',    hint: 'http://YOUR_MAC_IP:3001  (run: ipconfig getifaddr en0)' },
            ].map(r => (
              <div key={r.n} className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                style={{ background: '#fff', border: '1px solid #fde68a' }}>
                <span className="w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center shrink-0"
                  style={{ background: '#f59e0b' }}>{r.n}</span>
                <div>
                  <code className="text-xs font-bold" style={{ color: '#dc2626' }}>{r.key}</code>
                  <span className="text-xs ml-1.5" style={{ color: '#6b7280' }}>{r.hint}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mx-4 mb-3 mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
            <div className="flex items-center justify-between px-4 py-2" style={{ background: '#1e293b' }}>
              <div className="flex items-center gap-1.5">
                {['bg-red-400', 'bg-yellow-400', 'bg-green-400'].map(c => (
                  <span key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />
                ))}
                <span className="text-xs font-mono ml-2" style={{ color: '#64748b' }}>
                  staysync_esp32cam.ino
                </span>
              </div>
              <button onClick={copy}
                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: copied ? '#16a34a' : '#2563eb', color: '#fff' }}>
                {copied ? '✓ Copied!' : '📋 Copy All'}
              </button>
            </div>
            <pre className="p-4 text-xs overflow-auto leading-relaxed"
              style={{ color: '#e2e8f0', maxHeight: 260, fontFamily: 'monospace', background: '#0f172a' }}>
              {SKETCH}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Terminal line ───────────────────────────────────────── */
function Cmd({ children }) {
  const [ok, setOk] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children)
      .then(() => { setOk(true); setTimeout(() => setOk(false), 2000); });
  };
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={{ background: '#0f172a', border: '1px solid #334155' }}>
      <span className="text-xs font-bold shrink-0" style={{ color: '#4ade80' }}>$</span>
      <code className="text-xs font-mono flex-1 truncate" style={{ color: '#93c5fd' }}>{children}</code>
      <button onClick={copy}
        className="text-xs font-bold px-2.5 py-1 rounded-lg shrink-0"
        style={{ background: ok ? '#16a34a' : '#1d4ed8', color: '#fff' }}>
        {ok ? '✓' : 'Copy'}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ESP32 TAB  —  USB detection via Web Serial API
═══════════════════════════════════════════════════════════ */
function ESP32Tab() {
  const router = useRouter();

  // phase: idle | connecting | reading | detected | error | done
  const [phase, setPhase]       = useState('idle');
  const [log,   setLog]         = useState([]);
  const [camInfo, setCamInfo]   = useState(null); // { cameraId, wifiSsid, serverUrl }
  const [camName, setCamName]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [errMsg, setErrMsg]     = useState('');
  const [hasSerial, setHasSerial] = useState(false);

  const portRef    = useRef(null);
  const readerRef  = useRef(null);
  const cancelRef  = useRef(false);
  const logEndRef  = useRef(null);

  useEffect(() => {
    setHasSerial('serial' in navigator);
  }, []);

  const addLog = (line, type = 'info') =>
    setLog(prev => [...prev.slice(-80), { line, type, ts: Date.now() }]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  /* ── connect via Web Serial ── */
  const connectUSB = async () => {
    setPhase('connecting');
    setLog([]);
    setCamInfo(null);
    setErrMsg('');
    cancelRef.current = false;

    try {
      addLog('Opening USB port picker…', 'info');
      const port = await navigator.serial.requestPort();
      portRef.current = port;

      // Close if already open
      if (port.readable) {
        try { await port.close(); } catch {}
        await new Promise(r => setTimeout(r, 600));
      }

      await port.open({ baudRate: 115200 });
      setPhase('reading');
      addLog('✅ USB connected — waiting for ESP32 boot…', 'ok');
      addLog('(Press EN/RST button on ESP32 to reboot it now)', 'dim');

      const decoder = new TextDecoder();
      let buf = '';
      let detected = false;

      const reader = port.readable.getReader();
      readerRef.current = reader;

      // Timeout: if nothing useful in 30s, hint the user
      const timeout = setTimeout(() => {
        if (!detected) {
          addLog('⏱  No ESP32 output detected — try pressing EN button on the board', 'warn');
        }
      }, 30000);

      try {
        while (!cancelRef.current) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value);
          const lines = buf.split(/\r?\n/);
          buf = lines.pop() ?? '';

          for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;

            // Classify line for colour
            const type = line.startsWith('ERROR') ? 'error'
              : line.includes('✅') || line.includes('OK') || line.includes('sent OK') || line.includes('Connected!') ? 'ok'
              : line.includes('===') ? 'header'
              : 'info';

            addLog(line, type);

            // Parse camera info from boot output
            if (line.includes('=== StaySync ESP32-CAM ===')) {
              addLog('🔍 StaySync firmware detected!', 'ok');
            }

            const camMatch  = line.match(/^Camera ID:\s*(.+)/);
            const ssidMatch = line.match(/^WiFi:\s*(.+)/);
            const urlMatch  = line.match(/^Server:\s*(.+)/);

            if (camMatch && !detected) {
              const info = {
                cameraId:  camMatch[1].trim(),
                wifiSsid:  ssidMatch ? ssidMatch[1].trim() : '—',
                serverUrl: urlMatch  ? urlMatch[1].trim()  : '—',
              };
              detected = true;
              clearTimeout(timeout);
              setCamInfo(info);
              setCamName('ESP32 Camera');
              setPhase('detected');
              addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'dim');
              addLog(`🎉 Camera detected: ${info.cameraId}`, 'ok');
              addLog(`   WiFi: ${info.wifiSsid}`, 'dim');
              addLog(`   Server: ${info.serverUrl}`, 'dim');
            }
          }
        }
      } finally {
        clearTimeout(timeout);
        try { reader.releaseLock(); } catch {}
      }
    } catch (err) {
      if (err.name === 'NotFoundError') {
        setPhase('idle');
        addLog('No port selected — click Detect again and choose your ESP32', 'warn');
      } else {
        const msg = err.name === 'InvalidStateError' || (err.message || '').includes('open')
          ? 'Port locked — close Arduino IDE, unplug/replug ESP32, try again'
          : (err.message || 'Could not open port');
        setErrMsg(msg);
        setPhase('error');
        addLog(`❌ ${msg}`, 'error');
      }
    }
  };

  /* ── disconnect ── */
  const disconnect = async () => {
    cancelRef.current = true;
    try { readerRef.current?.cancel(); } catch {}
    try { portRef.current?.close(); }   catch {}
    portRef.current  = null;
    readerRef.current = null;
    setPhase('idle');
    setLog([]);
    setCamInfo(null);
  };

  /* ── register camera ── */
  const registerCamera = async () => {
    if (!camInfo) return;
    setSaving(true);
    const camData = {
      id:       camInfo.cameraId,
      name:     camName.trim() || 'ESP32 Camera',
      type:     'esp32',
      status:   'online',
      location: '',
    };
    saveLocalCamera(camData);
    try { await post('/cameras/register', camData); } catch {}
    setPhase('done');
    setTimeout(() => router.push(`/cameras/view?id=${camInfo.cameraId}`), 1800);
  };

  /* ── log colour map ── */
  const logColor = { ok: '#4ade80', error: '#f87171', warn: '#fbbf24', header: '#60a5fa', dim: '#475569', info: '#94a3b8' };

  /* ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">

      {/* Sketch + instructions */}
      <SketchCard />

      {/* Prerequisites */}
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: '#fff', border: '1.5px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#2563eb' }}>
            <Icon name="monitor" size={14} color="#fff" />
          </div>
          <p className="text-sm font-bold" style={{ color: '#0f172a' }}>Before detecting — start the backend</p>
        </div>
        <p className="text-xs" style={{ color: '#64748b' }}>
          Open Terminal and run (keep it open):
        </p>
        <Cmd>cd ~/Downloads/staysync &amp;&amp; node server.js</Cmd>
        <p className="text-xs" style={{ color: '#64748b' }}>
          Or use the one-command launcher:
        </p>
        <Cmd>cd ~/Downloads/staysync &amp;&amp; ./start.sh</Cmd>
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 mt-1"
          style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <span className="text-xs shrink-0">💡</span>
          <p className="text-xs" style={{ color: '#1e40af' }}>
            <strong>Mac IP for the sketch:</strong> run <code className="font-mono bg-blue-50 px-1 rounded">ipconfig getifaddr en0</code> in Terminal.
            Use that IP in <code className="font-mono bg-blue-50 px-1 rounded">SERVER_URL</code> — e.g. <code className="font-mono">http://192.168.1.42:3001</code>
          </p>
        </div>
      </div>

      {/* ── DETECT PANEL ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#fff', border: `1.5px solid ${phase === 'detected' ? '#86efac' : phase === 'error' ? '#fca5a5' : '#e2e8f0'}`, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b"
          style={{
            background: phase === 'detected' ? '#f0fdf4' : phase === 'error' ? '#fef2f2' : phase === 'reading' ? '#fafafa' : '#f8fafc',
            borderColor: phase === 'detected' ? '#bbf7d0' : phase === 'error' ? '#fecaca' : '#f1f5f9',
          }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: phase === 'detected' ? '#16a34a' : phase === 'error' ? '#dc2626' : phase === 'reading' ? '#2563eb' : '#64748b',
              boxShadow: `0 2px 8px ${phase === 'detected' ? '#16a34a44' : phase === 'reading' ? '#2563eb44' : 'transparent'}`,
            }}>
            <Icon name={phase === 'detected' ? 'check' : phase === 'error' ? 'warning' : 'signal'} size={16} color="#fff" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: '#0f172a' }}>
              {phase === 'idle'      && 'Detect ESP32-CAM via USB'}
              {phase === 'connecting'&& 'Opening USB port…'}
              {phase === 'reading'   && 'Reading serial output…'}
              {phase === 'detected'  && `Camera detected: ${camInfo?.cameraId}`}
              {phase === 'error'     && 'Connection error'}
              {phase === 'done'      && '✅ Camera registered!'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {phase === 'idle'      && (hasSerial ? 'Chrome/Edge only — plug in ESP32 first' : '⚠️ Requires Chrome or Edge browser')}
              {phase === 'connecting'&& 'Pick your ESP32 port from the picker'}
              {phase === 'reading'   && 'Press EN button on ESP32 if nothing appears…'}
              {phase === 'detected'  && `WiFi: ${camInfo?.wifiSsid}  ·  Server: ${camInfo?.serverUrl}`}
              {phase === 'error'     && errMsg}
              {phase === 'done'      && 'Redirecting to camera view…'}
            </p>
          </div>
          {(phase === 'reading' || phase === 'detected') && (
            <button onClick={disconnect}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ border: '1px solid #e2e8f0', color: '#64748b' }}>
              Disconnect
            </button>
          )}
        </div>

        {/* Connect button — idle or error */}
        {(phase === 'idle' || phase === 'error') && (
          <div className="p-4">
            {!hasSerial ? (
              <div className="rounded-xl p-4 text-center space-y-2"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                <p className="text-sm font-bold" style={{ color: '#dc2626' }}>Chrome or Edge required</p>
                <p className="text-xs" style={{ color: '#6b7280' }}>
                  Web Serial API is not supported in Safari or Firefox.
                  Open this page in <strong>Google Chrome</strong>.
                </p>
              </div>
            ) : (
              <button onClick={connectUSB}
                className="w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
                }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <Icon name="plug" size={18} color="#fff" />
                </div>
                Detect ESP32-CAM via USB
              </button>
            )}
            <p className="text-xs text-center mt-3" style={{ color: '#94a3b8' }}>
              Plug in ESP32 via USB → click above → pick the port → reboot ESP32 with EN button
            </p>
          </div>
        )}

        {/* Serial log — reading or detected */}
        {(phase === 'reading' || phase === 'detected') && log.length > 0 && (
          <div className="mx-4 mb-4 mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#1e293b' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: phase === 'detected' ? '#4ade80' : '#2563eb', animation: 'pulse 1.5s infinite' }} />
              <span className="text-xs font-mono" style={{ color: '#64748b' }}>Serial Monitor — 115200 baud</span>
            </div>
            <div className="p-3 space-y-0.5 font-mono text-xs overflow-auto" style={{ background: '#0f172a', maxHeight: 200 }}>
              {log.map((entry, i) => (
                <p key={i} style={{ color: logColor[entry.type] || '#94a3b8' }}>{entry.line}</p>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* ── Detected → register form ── */}
        {phase === 'detected' && camInfo && (
          <div className="p-4 pt-0 space-y-3">
            {/* Info chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: camInfo.cameraId, icon: 'camera',  color: '#2563eb' },
                { label: camInfo.wifiSsid, icon: 'wifi',    color: '#059669' },
                { label: camInfo.serverUrl,icon: 'monitor', color: '#7c3aed' },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: `${c.color}18`, border: `1px solid ${c.color}33`, color: c.color }}>
                  <Icon name={c.icon} size={11} color={c.color} />
                  {c.label}
                </div>
              ))}
            </div>

            {/* Name input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1.5"
                style={{ color: '#374151' }}>Camera name in portal</label>
              <input value={camName} onChange={e => setCamName(e.target.value)}
                placeholder="e.g. Living Room"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#111827' }} />
            </div>

            {/* Register button */}
            <button onClick={registerCamera} disabled={saving || !camName.trim()}
              className="w-full py-3.5 rounded-xl text-base font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg,#16a34a,#15803d)',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
              }}>
              <Icon name="check" size={18} color="#fff" />
              {saving ? 'Registering…' : 'Register Camera'}
            </button>

            <p className="text-xs text-center" style={{ color: '#9ca3af' }}>
              Frames will appear in the portal every 5 seconds automatically
            </p>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="p-6 text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: '#f0fdf4', border: '2px solid #bbf7d0' }}>
              <Icon name="check" size={28} color="#16a34a" />
            </div>
            <p className="text-base font-bold" style={{ color: '#16a34a' }}>
              {camName || 'Camera'} registered!
            </p>
            <p className="text-xs" style={{ color: '#6b7280' }}>
              Redirecting to live view…
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

/* ── Mac/Webcam tab ──────────────────────────────────────── */
function MacTab() {
  const router = useRouter();
  const [name, setName] = useState('Webcam');
  const [registered, setRegistered] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1.5px solid #bfdbfe' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#2563eb', boxShadow: '0 2px 8px rgba(37,99,235,.3)' }}>
          <Icon name="monitor" size={18} color="#fff" />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: '#1e3a8a' }}>Mac / PC Webcam</p>
          <p className="text-sm mt-0.5" style={{ color: '#3b82f6' }}>
            Uses your Mac's built-in webcam. Streams frames to Gemma 4 every 3 seconds.
          </p>
        </div>
      </div>
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: '#fff', border: '1.5px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
        <label className="text-xs font-bold uppercase tracking-wide block" style={{ color: '#374151' }}>
          Camera name
        </label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Desk Camera"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#111827' }} />
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

/* ── Phone tab ───────────────────────────────────────────── */
function PhoneTab() {
  const router = useRouter();
  const [name, setName] = useState('Phone Camera');
  const [registered, setRegistered] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1.5px solid #bbf7d0' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#059669', boxShadow: '0 2px 8px rgba(5,150,105,.3)' }}>
          <Icon name="phone" size={18} color="#fff" />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: '#064e3b' }}>Phone Browser Camera</p>
          <p className="text-sm mt-0.5" style={{ color: '#059669' }}>
            Open on your phone in Chrome. Uses back camera, streams to Gemma 4 every 3 seconds.
          </p>
        </div>
      </div>
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: '#fff', border: '1.5px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
        <label className="text-xs font-bold uppercase tracking-wide block" style={{ color: '#374151' }}>
          Camera name
        </label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Patient's Room"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#111827' }} />
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
  { id: 'esp32', icon: 'signal',  label: 'ESP32-CAM', sub: 'Hardware',  color: '#2563eb' },
  { id: 'mac',   icon: 'monitor', label: 'Mac / PC',  sub: 'Webcam',    color: '#7c3aed' },
  { id: 'phone', icon: 'phone',   label: 'Phone',     sub: 'Browser',   color: '#059669' },
];

export default function CameraSetupPage() {
  const router = useRouter();
  const [tab, setTab] = useState('esp32');

  return (
    <div className="min-h-screen pb-24" style={{ background: '#f1f5f9' }}>

      {/* Hero header */}
      <div className="px-4 pt-4 pb-5"
        style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)' }}>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' }}>
            <Icon name="arrow-right" size={16} color="#94a3b8"
              style={{ transform: 'rotate(180deg)', display: 'block' }} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Add Camera</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>Choose your camera type</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-3 gap-2">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="rounded-2xl py-3.5 px-2 flex flex-col items-center gap-1.5 transition-all"
                style={{
                  background: active ? t.color : 'rgba(255,255,255,.05)',
                  border: `1.5px solid ${active ? t.color : 'rgba(255,255,255,.08)'}`,
                  boxShadow: active ? `0 4px 14px ${t.color}44` : 'none',
                }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: active ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)' }}>
                  <Icon name={t.icon} size={18} color={active ? '#fff' : '#64748b'} />
                </div>
                <span className="text-xs font-bold" style={{ color: active ? '#fff' : '#64748b' }}>
                  {t.label}
                </span>
                <span className="text-xs" style={{ color: active ? 'rgba(255,255,255,.65)' : '#475569' }}>
                  {t.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === 'esp32' && <ESP32Tab />}
        {tab === 'mac'   && <MacTab />}
        {tab === 'phone' && <PhoneTab />}
      </div>
    </div>
  );
}
