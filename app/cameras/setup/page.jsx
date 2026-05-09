'use client';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useRouter } from 'next/navigation';
import BrowserCamera from '@/components/BrowserCamera';
import Icon from '@/components/Icon';

const BAUD_RATE = 115200;
const ENCODER = new TextEncoder();

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
      addLog('Connected via USB serial');
    } catch (err) {
      setStatus('error');
      addLog(`Error: ${err.message}`);
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
      addLog('Credentials sent — waiting 8s for connection...');
      setStatus('waiting');
      await new Promise(r => setTimeout(r, 8000));
      await post('/cameras/register', { id: 'esp32-livingroom', name: form.name, location: form.location || 'room' });
      addLog(`Camera "${form.name}" registered`);
      setStatus('done');
      setTimeout(() => router.push('/cameras'), 2000);
    } catch (err) { setStatus('error'); addLog(`Error: ${err.message}`); }
  };

  const fields = [
    { key: 'name', label: 'Camera name', placeholder: 'Living Room' },
    { key: 'location', label: 'Room / location', placeholder: 'living_room' },
    { key: 'ssid', label: 'WiFi network name', placeholder: 'MyWiFi' },
    { key: 'password', label: 'WiFi password', placeholder: '••••••••', type: 'password' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-[#111] border border-orange-900 rounded-xl p-4 text-sm text-[#aaa] space-y-1.5">
        <div className="flex items-center gap-2 text-orange-400 font-semibold mb-2">
          <Icon name="warning" size={16} /> Before connecting
        </div>
        <div>1. Flash firmware via Arduino IDE first</div>
        <div>2. Board must be <span className="text-white font-semibold">AI Thinker ESP32-CAM</span></div>
        <div>3. Close Arduino Serial Monitor before clicking Connect</div>
      </div>

      <div className="bg-[#111] border border-[#222] rounded-xl p-4">
        <div className="text-base font-semibold mb-3 text-white">Step 1 — Connect via USB</div>
        {status === 'idle' || status === 'error' ? (
          <button onClick={connectSerial}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2">
            <Icon name="plug" size={18} />
            Connect Camera
          </button>
        ) : (
          <div className="flex items-center gap-2 text-green-400 text-base">
            <Icon name="check" size={18} /> Connected
          </div>
        )}
        {!('serial' in navigator) && (
          <p className="text-red-400 text-sm mt-3 flex items-center gap-2">
            <Icon name="warning" size={14} />
            Use Chrome or Edge on desktop — Web Serial not supported here.
          </p>
        )}
      </div>

      {['connected', 'flashing', 'waiting', 'done'].includes(status) && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
          <div className="text-base font-semibold text-white">Step 2 — Camera Details</div>
          {fields.map(({ key, label, placeholder, type = 'text' }) => (
            <div key={key}>
              <label className="text-sm text-[#888] block mb-1.5">{label}</label>
              <input type={type} value={form[key]} placeholder={placeholder}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-black border border-[#333] rounded-xl px-4 py-3 text-base text-white outline-none focus:border-blue-600" />
            </div>
          ))}
          <button onClick={flashCredentials} disabled={status !== 'connected'}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            <Icon name="plug" size={18} />
            Flash & Connect
          </button>
        </div>
      )}

      {log.length > 0 && (
        <div className="bg-black border border-[#222] rounded-xl p-4 font-mono text-sm text-[#888] space-y-1.5">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

function MacCameraTab() {
  const router = useRouter();
  const [name, setName] = useState('Mac Camera');
  const [registered, setRegistered] = useState(false);

  return (
    <div className="space-y-4">
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 text-sm text-[#888]">
        Uses your Mac's built-in webcam or any USB camera. Streams frames to Gemma 4 every 3 seconds — no hardware needed.
      </div>
      <div>
        <label className="text-sm text-[#888] block mb-1.5">Camera name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-black border border-[#333] rounded-xl px-4 py-3 text-base text-white outline-none focus:border-blue-600" />
      </div>
      <BrowserCamera cameraId="browser-mac" cameraName={name} onRegistered={() => setRegistered(true)} />
      {registered && (
        <button onClick={() => router.push('/cameras')}
          className="w-full border border-blue-700 text-blue-400 py-3.5 rounded-xl text-base flex items-center justify-center gap-2">
          Go to Cameras <Icon name="arrow-right" size={16} />
        </button>
      )}
    </div>
  );
}

function PhoneCameraTab() {
  const router = useRouter();
  const [name, setName] = useState('Phone Camera');
  const [registered, setRegistered] = useState(false);

  return (
    <div className="space-y-4">
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 text-sm text-[#888]">
        Open this page on your phone in Chrome. It uses the back camera and streams frames to Gemma 4 every 3 seconds.
      </div>
      <div>
        <label className="text-sm text-[#888] block mb-1.5">Camera name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-black border border-[#333] rounded-xl px-4 py-3 text-base text-white outline-none focus:border-blue-600" />
      </div>
      <BrowserCamera cameraId="browser-phone" cameraName={name} onRegistered={() => setRegistered(true)} />
      {registered && (
        <button onClick={() => router.push('/cameras')}
          className="w-full border border-blue-700 text-blue-400 py-3.5 rounded-xl text-base flex items-center justify-center gap-2">
          Go to Cameras <Icon name="arrow-right" size={16} />
        </button>
      )}
    </div>
  );
}

const TABS = [
  { id: 'esp32', icon: 'signal',   label: 'ESP32-CAM',  sub: 'Hardware' },
  { id: 'mac',   icon: 'monitor',  label: 'Mac Camera', sub: 'Webcam' },
  { id: 'phone', icon: 'phone',    label: 'Phone',      sub: 'Browser' },
];

export default function CameraSetupPage() {
  const [tab, setTab] = useState('esp32');

  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      <div className="flex items-center gap-3 mb-5">
        <Icon name="camera" size={22} className="text-white" />
        <div>
          <h1 className="text-2xl font-bold text-white">Add Camera</h1>
          <p className="text-sm text-[#666]">Choose your camera type below</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 px-1 rounded-xl text-center transition-colors
              ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-[#111] border border-[#222] text-[#666]'}`}>
            <div className="flex justify-center mb-1">
              <Icon name={t.icon} size={18} />
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
