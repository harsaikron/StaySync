'use client';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useRouter } from 'next/navigation';
import BrowserCamera from '@/components/BrowserCamera';

const BAUD_RATE = 115200;
const ENCODER = new TextEncoder();

// ─── Tab: ESP32-CAM via USB Serial ───────────────────────────────────────────
function ESP32Tab() {
  const router = useRouter();
  const [port, setPort] = useState(null);
  const [status, setStatus] = useState('idle');
  const [form, setForm] = useState({ name: '', location: '', ssid: '', password: '' });
  const [log, setLog] = useState([]);
  const addLog = (msg) => setLog(prev => [...prev, msg]);

  const connectSerial = async () => {
    setStatus('connecting');
    addLog('Requesting serial port access...');
    let p = port;
    try {
      if (!p) { p = await navigator.serial.requestPort(); setPort(p); }
      for (let i = 1; i <= 5; i++) {
        try {
          if (p.readable) break;
          await p.open({ baudRate: BAUD_RATE });
          break;
        } catch {
          if (i === 5) throw new Error('Could not open port — close Arduino Serial Monitor and try again');
          addLog(`Waiting for port… (attempt ${i})`);
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      setStatus('connected');
      addLog('✓ ESP32-CAM connected via USB serial');
    } catch (err) {
      setStatus('error');
      addLog(`✗ ${err.message}`);
    }
  };

  const flashCredentials = async () => {
    if (!port || !form.name || !form.ssid || !form.password) { alert('Fill all fields'); return; }
    try {
      setStatus('flashing');
      addLog('Sending WiFi credentials to ESP32-CAM...');
      const writer = port.writable.getWriter();
      const payload = JSON.stringify({
        ssid: form.ssid, password: form.password,
        server_url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      }) + '\n';
      await writer.write(ENCODER.encode(payload));
      writer.releaseLock();
      addLog('✓ Credentials sent — waiting for ESP32 to connect (8s)...');
      setStatus('waiting');
      await new Promise(r => setTimeout(r, 8000));
      const camId = `esp32-livingroom`;
      await post('/cameras/register', { id: camId, name: form.name, location: form.location || 'room' });
      addLog(`✓ Camera "${form.name}" registered!`);
      setStatus('done');
      setTimeout(() => router.push('/cameras'), 2000);
    } catch (err) { setStatus('error'); addLog(`✗ ${err.message}`); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-xs text-[#8b949e] space-y-1">
        <div className="text-[#f0883e] font-bold mb-2">⚠ Before connecting:</div>
        <div>1. Flash firmware to ESP32 in Arduino IDE first</div>
        <div>2. Board must be set to <span className="text-white font-bold">AI Thinker ESP32-CAM</span></div>
        <div>3. Close Arduino Serial Monitor before clicking Connect</div>
      </div>

      <div className="bg-[#21262d] rounded-lg p-4">
        <div className="font-medium mb-3">Step 1 — Connect via USB</div>
        {status === 'idle' || status === 'error' ? (
          <button onClick={connectSerial} className="w-full bg-[#1f6feb] text-white py-3 rounded-lg font-medium">
            🔌 Connect Camera
          </button>
        ) : (
          <div className="text-[#3fb950] text-sm">✓ Connected</div>
        )}
        {!('serial' in navigator) && (
          <p className="text-[#f85149] text-xs mt-2">Use Chrome or Edge on desktop — Web Serial not supported here.</p>
        )}
      </div>

      {(status === 'connected' || status === 'flashing' || status === 'waiting' || status === 'done') && (
        <div className="bg-[#21262d] rounded-lg p-4 space-y-3">
          <div className="font-medium mb-1">Step 2 — Camera Details</div>
          {[
            { key: 'name', label: 'Camera name', placeholder: 'Living Room' },
            { key: 'location', label: 'Room / location', placeholder: 'living_room' },
            { key: 'ssid', label: 'WiFi SSID', placeholder: 'StarHub_4594' },
            { key: 'password', label: 'WiFi password', placeholder: '••••••••', type: 'password' }
          ].map(({ key, label, placeholder, type = 'text' }) => (
            <div key={key}>
              <label className="text-xs text-[#8b949e] block mb-1">{label}</label>
              <input type={type} value={form[key]} placeholder={placeholder}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb]" />
            </div>
          ))}
          <button onClick={flashCredentials} disabled={status !== 'connected'}
            className="w-full bg-[#238636] text-white py-3 rounded-lg font-medium disabled:opacity-50">
            ⚡ Flash & Connect
          </button>
        </div>
      )}

      {log.length > 0 && (
        <div className="bg-[#161b22] rounded-lg p-3 font-mono text-xs text-[#8b949e] space-y-1">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Mac / Laptop webcam ─────────────────────────────────────────────────
function MacCameraTab() {
  const router = useRouter();
  const [name, setName] = useState('Mac Camera');
  const [registered, setRegistered] = useState(false);
  const camId = 'browser-mac';

  const handleRegistered = () => {
    setRegistered(true);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-xs text-[#8b949e]">
        Uses your Mac's built-in webcam or any USB camera. Streams frames to Gemma 4 every 3 seconds via the browser — no hardware needed.
      </div>
      <div>
        <label className="text-xs text-[#8b949e] block mb-1">Camera name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb]" />
      </div>
      <BrowserCamera cameraId={camId} cameraName={name} onRegistered={handleRegistered} />
      {registered && (
        <button onClick={() => router.push('/cameras')}
          className="w-full border border-[#238636] text-[#3fb950] py-2 rounded-lg text-sm">
          → Go to Cameras
        </button>
      )}
    </div>
  );
}

// ─── Tab: Phone camera ────────────────────────────────────────────────────────
function PhoneCameraTab() {
  const router = useRouter();
  const [name, setName] = useState('Phone Camera');
  const [registered, setRegistered] = useState(false);
  const camId = 'browser-phone';

  return (
    <div className="space-y-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-xs text-[#8b949e]">
        Open this page on your phone in Chrome. It uses the phone's back camera and streams frames to Gemma 4 every 3 seconds — ideal for testing without ESP32 hardware.
      </div>
      <div>
        <label className="text-xs text-[#8b949e] block mb-1">Camera name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb]" />
      </div>
      <BrowserCamera cameraId={camId} cameraName={name} onRegistered={() => setRegistered(true)} />
      {registered && (
        <button onClick={() => router.push('/cameras')}
          className="w-full border border-[#238636] text-[#3fb950] py-2 rounded-lg text-sm">
          → Go to Cameras
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'esp32', label: '📡 ESP32-CAM', sub: 'Hardware' },
  { id: 'mac',   label: '💻 Mac Camera', sub: 'Webcam' },
  { id: 'phone', label: '📱 Phone Camera', sub: 'Browser' },
];

export default function CameraSetupPage() {
  const [tab, setTab] = useState('esp32');

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <h1 className="text-xl font-bold mb-1">📷 Add Camera</h1>
      <p className="text-[#8b949e] text-sm mb-4">Choose your camera type below.</p>

      {/* Tab bar */}
      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-1 rounded-lg text-center transition-colors ${tab === t.id
              ? 'bg-[#1f6feb] text-white' : 'bg-[#21262d] text-[#8b949e]'}`}>
            <div className="text-sm">{t.label}</div>
            <div className="text-[10px] opacity-70">{t.sub}</div>
          </button>
        ))}
      </div>

      {tab === 'esp32' && <ESP32Tab />}
      {tab === 'mac'   && <MacCameraTab />}
      {tab === 'phone' && <PhoneCameraTab />}
    </div>
  );
}
