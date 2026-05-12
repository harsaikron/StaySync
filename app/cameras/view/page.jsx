'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { speakText } from '@/lib/tts';
import Icon from '@/components/Icon';

function formatTs(ts) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
function formatAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return formatTs(ts);
}

/* ── Live browser-camera widget (only for type='browser') ── */
function LiveCameraWidget({ cameraId }) {
  const videoRef = useRef(null);
  const [active, setActive] = useState(false);
  const [err, setErr] = useState('');

  const start = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setActive(true);
    } catch (e) {
      setErr(e.name === 'NotAllowedError' ? 'Camera permission denied — allow it in browser settings' : e.message);
    }
  };
  const stop = () => {
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  };
  useEffect(() => () => stop(), []);

  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden relative"
        style={{ aspectRatio: '16/9', background: '#e8e8e8', border: '1px solid #d0d0d0' }}>
        <video ref={videoRef} autoPlay playsInline muted
          className="w-full h-full object-cover"
          style={{ display: active ? 'block' : 'none' }} />
        {!active && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Icon name="camera" size={40} color="#bbb" />
            <p className="text-sm" style={{ color: '#999' }}>Tap to preview webcam</p>
          </div>
        )}
        {active && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #22c55e' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"
              style={{ animation: 'pulse 1.5s infinite' }} />
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>
        )}
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-2">
        {!active
          ? <button onClick={start}
              className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: '#1d4ed8', color: '#fff' }}>
              <Icon name="camera" size={16} color="#fff" /> Start Live Preview
            </button>
          : <button onClick={stop}
              className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: '#dc2626', color: '#fff' }}>
              <Icon name="stop" size={16} color="#fff" /> Stop Preview
            </button>
        }
        <a href="/cameras/setup"
          className="px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-1.5"
          style={{ border: '1px solid #d0d0d0', color: '#1d4ed8' }}>
          <Icon name="settings" size={14} color="#1d4ed8" /> Setup
        </a>
      </div>
    </div>
  );
}

/* ── Main detail page ───────────────────────────────────── */
function CameraDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id') || '';

  const [camera,    setCamera]   = useState(null);
  const [frames,    setFrames]   = useState([]);
  const [liveFrame, setLiveFrame] = useState(null);
  const [liveTs,    setLiveTs]   = useState(null);
  const [selected,  setSelected] = useState(0);
  const [paused,    setPaused]   = useState(false);
  const [backendUrl, setBackendUrl] = useState('');

  const loadData = () => {
    try {
      const local = JSON.parse(localStorage.getItem('staysync-local-cameras') || '[]');
      const found = local.find(c => c.id === id);
      setCamera(found || { id, name: id, status: 'online', type: 'esp32', location: '' });

      const h = JSON.parse(localStorage.getItem(`staysync-cam-frames-${id}`) || '[]');
      setFrames(h);

      const lf = localStorage.getItem(`staysync-cam-frame-${id}`);
      if (lf) { setLiveFrame(lf); setLiveTs(Date.now()); }

      setPaused(localStorage.getItem(`staysync-cam-paused-${id}`) === 'true');

      const url = (localStorage.getItem('staysync-backend-url') || process.env.NEXT_PUBLIC_API_URL || '').trim();
      setBackendUrl(url);
    } catch {}
  };

  useEffect(() => { loadData(); }, [id]);
  useEffect(() => { const t = setInterval(loadData, 3000); return () => clearInterval(t); }, [id]);

  const togglePause = () => {
    const next = !paused;
    try { localStorage.setItem(`staysync-cam-paused-${id}`, String(next)); } catch {}
    setPaused(next);
  };

  if (!camera) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f5f5' }}>
        <p style={{ color: '#888' }}>Loading…</p>
      </div>
    );
  }

  const sel = frames[selected];
  const displayFrame = sel?.frame || liveFrame;
  const displayGuidance = sel?.guidance || (typeof window !== 'undefined' ? localStorage.getItem(`staysync-cam-guidance-${id}`) : '') || '';
  const TYPE_LABEL = { browser: 'Browser / Webcam', esp32: 'ESP32-CAM', phone: 'Phone Camera' };
  const backendOk = backendUrl && !backendUrl.includes('localhost') && !backendUrl.includes('127.0.0.1');
  const isLive = !paused && !!liveFrame;

  return (
    <div className="min-h-screen pb-24" style={{ background: '#f5f5f5' }}>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: '#ffffff', borderColor: '#e0e0e0' }}>
        <button onClick={() => router.back()}
          className="p-2 rounded-xl"
          style={{ border: '1px solid #e0e0e0', color: '#0a0a0a' }}>
          <Icon name="arrow-right" size={18} color="#0a0a0a"
            style={{ transform: 'rotate(180deg)', display: 'block' }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate" style={{ color: '#0a0a0a' }}>
            {camera.name || camera.id}
          </h1>
          <p className="text-xs" style={{ color: '#666' }}>
            {TYPE_LABEL[camera.type] || 'Camera'}{camera.location ? ` · ${camera.location}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {paused && (
            <span className="text-xs px-2 py-1 rounded-full font-semibold"
              style={{ background: '#fef3c7', color: '#92400e' }}>Paused</span>
          )}
          <button onClick={togglePause}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold"
            style={{
              background: paused ? '#dcfce7' : '#fee2e2',
              color: paused ? '#166534' : '#dc2626',
              border: `1px solid ${paused ? '#86efac' : '#fca5a5'}`,
            }}>
            <Icon name={paused ? 'play' : 'stop'} size={14} color={paused ? '#166534' : '#dc2626'} />
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Live feed card ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#ffffff', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ background: '#f8f8f8', borderColor: '#e8e8e8' }}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-gray-400'}`}
                style={isLive ? { animation: 'pulse 1.5s infinite' } : {}} />
              <span className="text-xs font-bold" style={{ color: '#333' }}>
                {isLive ? 'LIVE' : paused ? 'PAUSED' : 'WAITING FOR CAMERA'}
              </span>
            </div>
            {liveTs && <span className="text-xs" style={{ color: '#888' }}>{formatAgo(liveTs)}</span>}
          </div>

          {/* Frame area — GREY background */}
          <div className="relative" style={{ aspectRatio: '16/9', background: '#e8e8e8' }}>
            {liveFrame ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={liveFrame} alt="Live" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: '#d8d8d8' }}>
                  <Icon name="camera" size={32} color="#aaa" />
                </div>
                <p className="text-sm font-medium" style={{ color: '#888' }}>No frames captured yet</p>
                <p className="text-xs" style={{ color: '#aaa' }}>
                  {camera.type === 'esp32' ? 'ESP32-CAM will send frames when connected' : 'Start camera in Setup page'}
                </p>
              </div>
            )}

            {isLive && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid #22c55e' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"
                  style={{ animation: 'pulse 1.5s infinite' }} />
                <span className="text-xs font-bold text-white">LIVE</span>
              </div>
            )}
            {sel && (
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-xs"
                style={{ background: 'rgba(0,0,0,0.55)', color: '#ddd' }}>
                {formatTs(sel.ts)}
              </div>
            )}
          </div>
        </div>

        {/* ── Browser camera live preview (browser cameras only) ── */}
        {camera.type === 'browser' && (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="px-4 py-2.5 border-b flex items-center gap-2"
              style={{ background: '#f0f7ff', borderColor: '#bfdbfe' }}>
              <Icon name="camera" size={15} color="#1d4ed8" />
              <span className="text-sm font-bold" style={{ color: '#1d4ed8' }}>Live Webcam Preview</span>
            </div>
            <div className="p-4">
              <LiveCameraWidget cameraId={id} />
            </div>
          </div>
        )}

        {/* ── ESP32 setup guide (when no frames yet) ── */}
        {camera.type === 'esp32' && frames.length === 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="px-4 py-2.5 border-b flex items-center gap-2"
              style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
              <Icon name="warning" size={15} color="#d97706" />
              <span className="text-sm font-bold" style={{ color: '#92400e' }}>
                ESP32-CAM not sending frames yet
              </span>
            </div>
            <div className="p-4 space-y-3">
              {[
                { n: 1, color: '#dc2626', bg: '#fef2f2', border: '#fecaca',
                  title: 'Start the backend on your Mac',
                  body: 'Open Terminal → run: cd ~/Downloads/staysync && node server.js — leave it running. You should see "StaySync backend on port 3001".',
                  link: null },
                { n: 2, color: '#d97706', bg: '#fffbeb', border: '#fde68a',
                  title: 'Find Mac IP & flash sketch',
                  body: 'Run: ipconfig getifaddr en0 → copy the IP (e.g. 192.168.1.42). Go to Camera Setup → copy sketch → paste in Arduino IDE → fill WIFI_SSID, WIFI_PASSWORD, and SERVER_URL = http://192.168.1.42:3001 → upload.',
                  link: '/cameras/setup', linkLabel: 'Camera Setup →' },
                { n: 3, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0',
                  title: 'Open portal locally',
                  body: backendOk
                    ? `✓ Backend URL set: ${backendUrl.slice(0, 40)}${backendUrl.length > 40 ? '…' : ''}`
                    : 'In Terminal: cd ~/Downloads/staysync/portal && npm run dev → open http://localhost:3000 in your browser. Go to Settings → set backend URL to http://localhost:3001.',
                  link: backendOk ? null : '/settings', linkLabel: 'Settings →' },
                { n: 4, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
                  title: 'ESP32 stays connected via USB to Mac',
                  body: 'Keep the ESP32 plugged into your Mac via USB (it powers the board). Open Serial Monitor at 115200 baud to confirm "Frame sent OK". Frames appear here every 5 seconds automatically.',
                  link: null },
              ].map(s => (
                <div key={s.n} className="rounded-xl p-3 flex items-start gap-3"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: s.color }}>
                    {s.n}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: s.color }}>{s.title}</p>
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: '#555' }}>{s.body}</p>
                    {s.link && (
                      <a href={s.link}
                        className="inline-block mt-1.5 text-xs font-bold px-2.5 py-1 rounded-lg"
                        style={{ background: s.color, color: '#fff' }}>
                        {s.linkLabel}
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {!backendOk && (
                <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                  style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
                  <Icon name="info" size={14} color="#d97706" />
                  <p className="text-xs leading-snug" style={{ color: '#92400e' }}>
                    <strong>Portal backend URL not set.</strong> Go to <a href="/settings" style={{ textDecoration: 'underline' }}>Settings</a> → Camera → enter <code style={{ background: '#fde68a', borderRadius: 3, padding: '0 3px' }}>http://localhost:3001</code> → Save. (The ESP32 sketch uses your Mac IP directly, not this setting.)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Photo history ── */}
        {frames.length > 0 && (
          <div className="rounded-2xl overflow-hidden space-y-0"
            style={{ background: '#ffffff', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="px-4 py-2.5 border-b flex items-center justify-between"
              style={{ background: '#f8f8f8', borderColor: '#e8e8e8' }}>
              <div className="flex items-center gap-2">
                <Icon name="camera" size={15} color="#1d4ed8" />
                <span className="text-sm font-bold" style={{ color: '#0a0a0a' }}>Photo History</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                {frames.length} / 10
              </span>
            </div>

            <div className="p-3 space-y-3">
              {/* Thumbnails */}
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {frames.map((f, i) => (
                  <button key={f.ts} onClick={() => setSelected(i)}
                    className="relative rounded-xl overflow-hidden transition-all active:scale-95"
                    style={{
                      aspectRatio: '1',
                      border: i === selected ? '2px solid #1d4ed8' : '2px solid #e0e0e0',
                      boxShadow: i === selected ? '0 0 0 2px #bfdbfe' : 'none',
                    }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.frame} alt="" className="w-full h-full object-cover"
                      style={{ opacity: i === selected ? 1 : 0.65 }} />
                    {i === selected && (
                      <div className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(29,78,216,0.15)' }}>
                        <Icon name="check" size={14} color="#1d4ed8" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center"
                      style={{ background: 'rgba(0,0,0,0.55)', fontSize: 9, color: '#ddd' }}>
                      {new Date(f.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected frame large view */}
              {sel && (
                <div className="rounded-xl overflow-hidden relative"
                  style={{ aspectRatio: '16/9', background: '#e8e8e8', border: '1px solid #e0e0e0' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sel.frame} alt="Selected" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-xs"
                    style={{ background: 'rgba(0,0,0,0.55)', color: '#ddd' }}>
                    {formatTs(sel.ts)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Gemma 4 Analysis card ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#ffffff', border: '1px solid #bfdbfe', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <div className="flex items-center gap-2">
              <Icon name="bot" size={16} color="#2563eb" />
              <span className="text-sm font-bold" style={{ color: '#1e3a8a' }}>Gemma 4 Analysis</span>
            </div>
            {sel?.ts && (
              <span className="text-xs" style={{ color: '#6b7280' }}>{formatTs(sel.ts)}</span>
            )}
          </div>
          {/* Body */}
          <div className="p-4 space-y-4" style={{ background: '#f8faff' }}>
            {displayGuidance ? (
              <>
                <p className="text-base leading-relaxed" style={{ color: '#1e293b' }}>{displayGuidance}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: 'map-pin', color: '#ea580c', label: camera.location || 'Location' },
                    { icon: 'camera',  color: '#16a34a', label: camera.name || camera.id },
                    { icon: 'clock',   color: '#1d4ed8', label: sel ? formatTs(sel.ts) : 'Latest' },
                  ].map(chip => (
                    <div key={chip.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <Icon name={chip.icon} size={11} color={chip.color} />
                      <span className="text-xs" style={{ color: '#374151' }}>{chip.label}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => speakText(displayGuidance)}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: '#1d4ed8', color: '#fff' }}>
                  <Icon name="volume" size={16} color="#fff" /> Read Aloud
                </button>
              </>
            ) : (
              <div className="text-center py-8 space-y-2">
                <Icon name="bot" size={40} color="#bfdbfe" />
                <p className="text-sm font-medium" style={{ color: '#374151' }}>No AI analysis yet</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>
                  {camera.type === 'browser'
                    ? 'Start the camera in Setup → Gemma 4 will analyse each frame'
                    : 'Waiting for frames from the camera'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Browser camera shortcut */}
        {camera.type === 'browser' && (
          <a href="/cameras/setup"
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#ffffff', border: '1px solid #d0d0d0', color: '#1d4ed8' }}>
            <Icon name="camera" size={15} color="#1d4ed8" />
            Open Camera Setup to stream live
          </a>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

export default function CameraViewPage() {
  return (
    <Suspense>
      <CameraDetailContent />
    </Suspense>
  );
}
