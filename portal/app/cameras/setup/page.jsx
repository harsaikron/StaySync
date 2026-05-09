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
    setStatus('connecting');
    addLog('Requesting serial port access...');
    let p = port;
    try {
      if (!p) {
        p = await navigator.serial.requestPort();
        setPort(p);
      }
      // Port may be busy briefly after ESP32 DTR-reset — retry open up to 5 times
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          if (p.readable) break; // already open
          await p.open({ baudRate: BAUD_RATE });
          break;
        } catch (openErr) {
          if (attempt === 5) throw openErr;
          addLog(`Waiting for port… (attempt ${attempt})`);
          await new Promise(r => setTimeout(r, 1500));
        }
      }
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

      await new Promise(r => setTimeout(r, 8000));

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

      {log.length > 0 && (
        <div className="bg-[#161b22] rounded-lg p-3 font-mono text-xs text-[#8b949e] space-y-1">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
