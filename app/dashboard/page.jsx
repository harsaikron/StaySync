'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
// eslint-disable-next-line @next/next/no-img-element
import { get } from '@/lib/api';
import { useTTS } from '@/providers/TTSProvider';
import { speakText } from '@/lib/tts';
import { SSEProvider, useSSE } from '@/providers/SSEProvider';
import AlertBanner from '@/components/AlertBanner';
import RiskScoreBar from '@/components/RiskScoreBar';
import Icon from '@/components/Icon';

const DEFAULT_MEMORIES = [
  { id: 'mum',     label: 'Mum',          color: '#ec4899' },
  { id: 'dad',     label: 'Dad',          color: '#3b82f6' },
  { id: 'kids',    label: 'Kids',         color: '#f97316' },
  { id: 'holiday', label: 'Holiday',      color: '#10b981' },
  { id: 'home',    label: 'Our Home',     color: '#8b5cf6' },
];

function MemoriesCard() {
  const [memories, setMemories] = useState(DEFAULT_MEMORIES);
  const [photos, setPhotos] = useState({});
  const fileRef = useRef(null);
  const [pickingFor, setPickingFor] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('staysync-memories');
      const savedPhotos = localStorage.getItem('staysync-memory-photos');
      if (saved) setMemories(JSON.parse(saved));
      if (savedPhotos) setPhotos(JSON.parse(savedPhotos));
    } catch {}
  }, []);

  const pickPhoto = (memId) => {
    setPickingFor(memId);
    fileRef.current?.click();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !pickingFor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setPhotos(prev => {
        const next = { ...prev, [pickingFor]: dataUrl };
        try { localStorage.setItem('staysync-memory-photos', JSON.stringify(next)); } catch {}
        return next;
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setPickingFor(null);
  };

  const addMemory = () => {
    const label = prompt('Memory label (e.g. "Daughter in China"):');
    if (!label?.trim()) return;
    const colors = ['#ec4899','#3b82f6','#f97316','#10b981','#8b5cf6','#ef4444','#f59e0b'];
    const newMem = { id: `mem-${Date.now()}`, label: label.trim(), color: colors[memories.length % colors.length] };
    setMemories(prev => {
      const next = [...prev, newMem];
      try { localStorage.setItem('staysync-memories', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="heart" size={18} color="#ec4899" />
          <span className="text-base font-bold" style={{ color: 'var(--text,#fff)' }}>Memories</span>
        </div>
        <button onClick={addMemory}
          className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ border: '1px solid var(--border,#333)', color: 'var(--text-muted,#888)' }}>
          <Icon name="plus" size={13} color="var(--text-muted,#888)" />
          Add
        </button>
      </div>

      {/* Horizontal scroll strip */}
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {memories.map(mem => (
          <button key={mem.id} onClick={() => pickPhoto(mem.id)}
            className="shrink-0 flex flex-col items-center gap-2 rounded-2xl overflow-hidden active:scale-95 transition-transform"
            style={{ width: 88 }}>
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center"
              style={{
                background: photos[mem.id] ? 'transparent' : `${mem.color}22`,
                border: `2px solid ${mem.color}44`,
              }}>
              {photos[mem.id]
                ? <img src={photos[mem.id]} alt={mem.label} className="w-full h-full object-cover" />
                : <Icon name="heart" size={32} color={mem.color} />
              }
            </div>
            <span className="text-xs font-medium text-center leading-tight px-1"
              style={{ color: 'var(--text,#fff)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mem.label}
            </span>
          </button>
        ))}

        {/* Connect gallery CTA */}
        <button onClick={() => fileRef.current?.click()}
          className="shrink-0 flex flex-col items-center gap-2 rounded-2xl active:scale-95 transition-transform"
          style={{ width: 88 }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--surface-deep,#0a0a0a)', border: '2px dashed var(--border,#333)' }}>
            <Icon name="plus" size={28} color="var(--text-muted,#555)" />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted,#888)' }}>Gallery</span>
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function SuggestionCards({ events, alerts, patients }) {
  const suggestions = [];

  // Upcoming schedule items (next 60 mins)
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  for (const p of patients) {
    const routine = p.routine || {};
    for (const [key, time] of Object.entries(routine)) {
      if (!time) continue;
      const [h, m] = time.split(':').map(Number);
      const scheduled = h * 60 + m;
      const diff = scheduled - nowMins;
      if (diff > 0 && diff <= 60) {
        const labels = { wake: 'wake up', breakfast: 'breakfast', medicine: 'take tablets', lunch: 'lunch', dinner: 'dinner', sleep: 'bedtime' };
        suggestions.push({
          id: `sched-${p.id}-${key}`,
          icon: key === 'medicine' ? 'shield' : 'clock',
          color: key === 'medicine' ? '#f97316' : '#60a5fa',
          text: `${p.name?.split(' ')[0] || 'Patient'}'s ${labels[key] || key} is in ${diff} min`,
          action: key === 'medicine' ? 'Reminder: ' + (p.medications?.[0] || 'medications') : null,
        });
      }
    }
  }

  // Recent detection events
  for (const [camId, ev] of Object.entries(events)) {
    if (ev.severity === 'critical' || ev.severity === 'medium') {
      suggestions.push({
        id: `event-${camId}`,
        icon: 'warning',
        color: ev.severity === 'critical' ? '#ef4444' : '#f97316',
        text: ev.guidance || `Activity detected on camera ${camId}`,
        action: null,
      });
    }
  }

  // Active alerts
  for (const a of alerts.slice(0, 2)) {
    suggestions.push({
      id: `alert-${a.id}`,
      icon: 'bell',
      color: '#ef4444',
      text: a.message || 'New alert',
      action: null,
    });
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted,#888)' }}>Suggestions</h2>
      {suggestions.slice(0, 4).map(s => (
        <div key={s.id} className="flex items-start gap-3 bg-[#111] border border-[#222] rounded-xl px-4 py-3">
          <Icon name={s.icon} size={18} style={{ color: s.color, marginTop: 2 }} />
          <p className="text-sm flex-1 leading-snug" style={{ color: 'var(--text,#fff)' }}>{s.text}</p>
        </div>
      ))}
    </div>
  );
}

function CameraIntelCard({ cameras, latestEvents, onRefresh, onSpeak }) {
  const [learning,     setLearning]     = useState(false);
  const [pausedCams,   setPausedCams]   = useState({});
  const [frameHistory, setFrameHistory] = useState({});  // camId → [{ts, frame, guidance}]
  const [latestFrames, setLatestFrames] = useState({});  // camId → frame url
  const [latestGuide,  setLatestGuide]  = useState({});  // camId → guidance string
  const [openGallery,  setOpenGallery]  = useState(null);// camId whose gallery is open
  const [selFrame,     setSelFrame]     = useState(0);   // selected index in gallery

  const readStorage = useCallback(() => {
    const paused = {}, history = {}, frames = {}, guide = {};
    cameras.forEach(cam => {
      try {
        paused[cam.id]  = localStorage.getItem(`staysync-cam-paused-${cam.id}`) === 'true';
        const h = JSON.parse(localStorage.getItem(`staysync-cam-frames-${cam.id}`) || '[]');
        history[cam.id] = h;
        const f = localStorage.getItem(`staysync-cam-frame-${cam.id}`);
        const g = localStorage.getItem(`staysync-cam-guidance-${cam.id}`);
        if (f) frames[cam.id] = f;
        if (g) guide[cam.id]  = g;
      } catch {}
    });
    setPausedCams(paused);
    setFrameHistory(history);
    setLatestFrames(frames);
    setLatestGuide(guide);
  }, [cameras]);

  useEffect(() => { readStorage(); }, [readStorage]);
  useEffect(() => {
    const t = setInterval(readStorage, 4000);
    return () => clearInterval(t);
  }, [readStorage]);

  const togglePause = (camId) => {
    const next = !pausedCams[camId];
    try { localStorage.setItem(`staysync-cam-paused-${camId}`, String(next)); } catch {}
    setPausedCams(p => ({ ...p, [camId]: next }));
  };

  const autoLearn = async (guidance, camId) => {
    if (!guidance) return;
    setLearning(true);
    try {
      const base = localStorage.getItem('staysync-backend-url') || 'http://localhost:3001';
      await fetch(`${base}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'detection', message: `Camera ${camId} observed: ${guidance}`, user_type: 'ai', auto: true }),
      });
    } catch {}
    setLearning(false);
  };

  useEffect(() => {
    const entries = Object.entries(latestEvents);
    if (!entries.length) return;
    const [camId, event] = entries[0];
    if (event?.guidance) autoLearn(event.guidance, camId);
  }, [latestEvents]);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface,#111)', borderColor: 'var(--border,#222)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Icon name="camera" size={18} color="#60a5fa" />
          <span className="text-base font-bold" style={{ color: 'var(--text,#fff)' }}>Camera View</span>
          {learning && (
            <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: '#1e3a8a', color: '#93c5fd' }}>
              <Icon name="bot" size={10} color="#93c5fd" /> Learning…
            </span>
          )}
        </div>
        <button onClick={onRefresh}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
          style={{ border: '1px solid var(--border,#333)', color: '#60a5fa' }}>
          <Icon name="refresh" size={13} color="#60a5fa" /> Refresh
        </button>
      </div>

      {cameras.length === 0 ? (
        <div className="px-4 pb-6 text-center py-6" style={{ color: 'var(--text-muted,#555)' }}>
          <Icon name="camera" size={32} color="var(--text-muted,#444)" />
          <p className="text-sm mt-2">No cameras registered</p>
        </div>
      ) : (
        <div>
          {cameras.map((cam, idx) => {
            const event    = latestEvents[cam.id];
            const frame    = latestFrames[cam.id];
            const guidance = event?.guidance || latestGuide[cam.id];
            const paused   = pausedCams[cam.id];
            const history  = frameHistory[cam.id] || [];
            const isOpen   = openGallery === cam.id;

            return (
              <div key={cam.id} style={{ borderTop: idx > 0 ? '1px solid var(--border,#222)' : undefined }}>
                {/* Camera row */}
                <div className="px-4 py-3 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cam.status === 'online' && !paused ? 'bg-green-400' : 'bg-[#555]'}`} />
                  <a href={`/cameras/view?id=${encodeURIComponent(cam.id)}`}
                    className="text-sm font-semibold flex-1 flex items-center gap-1.5" style={{ color: 'var(--text,#fff)' }}>
                    {cam.name || cam.id}
                    <Icon name="chevron-right" size={12} color="var(--text-muted,#555)" />
                  </a>
                  {paused && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#451a03', color: '#fb923c' }}>Paused</span>
                  )}
                  {/* Photo count badge */}
                  {history.length > 0 && (
                    <button onClick={() => { setOpenGallery(isOpen ? null : cam.id); setSelFrame(0); }}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ background: isOpen ? '#1e3a8a' : 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#333)', color: isOpen ? '#93c5fd' : '#60a5fa' }}>
                      <Icon name="camera" size={12} color={isOpen ? '#93c5fd' : '#60a5fa'} />
                      {history.length} photo{history.length !== 1 ? 's' : ''}
                    </button>
                  )}
                  {/* Pause / Resume */}
                  <button onClick={() => togglePause(cam.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                    style={{ border: `1px solid ${paused ? '#16a34a' : '#7f1d1d'}`, color: paused ? '#4ade80' : '#f87171' }}>
                    <Icon name={paused ? 'play' : 'stop'} size={12} color={paused ? '#4ade80' : '#f87171'} />
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                </div>

                {/* Gallery — expands when Photos button is clicked */}
                {isOpen && history.length > 0 && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Thumbnail strip */}
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {history.map((h, i) => (
                        <button key={h.ts} onClick={() => setSelFrame(i)}
                          className="shrink-0 rounded-xl overflow-hidden transition-all"
                          style={{
                            width: 80, height: 60,
                            border: i === selFrame ? '2px solid #2563eb' : '2px solid transparent',
                            opacity: i === selFrame ? 1 : 0.65,
                          }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={h.frame} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>

                    {/* Selected photo large view */}
                    {history[selFrame] && (
                      <>
                        <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '4/3', maxHeight: 240, background: 'var(--surface-deep,#0a0a0a)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={history[selFrame].frame} alt="Camera snapshot"
                            className="w-full h-full object-cover" />
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted,#666)' }}>
                          {new Date(history[selFrame].ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          {' · '}{cam.name || cam.id}
                          {' · '}{selFrame + 1} of {history.length}
                        </p>

                        {/* AI description card — separate card as requested */}
                        {history[selFrame].guidance ? (
                          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--ai-card-body,#0a0f1e)', border: '1px solid var(--ai-card-border,#1e3a8a)' }}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon name="bot" size={14} color="#3b82f6" />
                                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--ai-card-text,#93c5fd)' }}>
                                  Gemma 4 — what it sees
                                </span>
                              </div>
                              <button onClick={() => onSpeak(history[selFrame].guidance)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                                style={{ border: '1px solid var(--blue,#1d4ed8)', color: 'var(--blue,#2563eb)' }}>
                                <Icon name="volume" size={11} color="var(--blue,#2563eb)" /> Speak
                              </button>
                            </div>
                            <p className="text-base leading-relaxed" style={{ color: 'var(--text,#fff)' }}>
                              {history[selFrame].guidance}
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)' }}>
                            <p className="text-sm" style={{ color: 'var(--text-muted,#555)' }}>
                              No AI description for this photo — backend may not have been connected.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Latest frame preview when gallery closed */}
                {!isOpen && frame && (
                  <div className="px-4 pb-3">
                    <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', maxHeight: 180, background: 'var(--surface-deep,#0a0a0a)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={frame} alt="Latest frame" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}

                {/* Latest guidance when gallery closed */}
                {!isOpen && guidance && (
                  <div className="mx-4 mb-3 rounded-xl p-3 space-y-1" style={{ background: 'var(--ai-card-body,#0a0f1e)', border: '1px solid var(--ai-card-border,#1e3a8a)' }}>
                    <div className="flex items-center gap-1.5">
                      <Icon name="bot" size={13} color="#3b82f6" />
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ai-card-text,#93c5fd)' }}>Gemma 4 sees</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text,#fff)' }}>{guidance}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-4 pt-2">
        <a href="/cameras"
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: '#2563eb', color: '#ffffff' }}>
          <Icon name="camera" size={15} color="#ffffff" /> Manage Cameras
        </a>
      </div>
    </div>
  );
}

const REMINDER_COLORS = { medicine: '#f97316', food: '#22c55e', sleep: '#8b5cf6', other: '#60a5fa' };
const REMINDER_ICONS  = { medicine: 'shield', food: 'clock', sleep: 'moon', other: 'bell' };

function ReminderBanner() {
  const [active, setActive] = useState(null);

  useEffect(() => {
    const check = () => {
      try {
        const reminders = JSON.parse(localStorage.getItem('staysync-reminders') || '[]');
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const today = now.toDateString();
        for (const r of reminders) {
          if (!r.enabled || r.time !== hhmm) continue;
          if (r.lastNotified === today) continue;
          // Mark notified
          const updated = reminders.map(x => x.id === r.id ? { ...x, lastNotified: today } : x);
          localStorage.setItem('staysync-reminders', JSON.stringify(updated));
          setActive(r);
          speakText(`Reminder: ${r.label}`);
          // Request browser notification permission and show if granted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('StaySync Care Reminder', { body: r.label, icon: '/icons/icon-192.png' });
          }
          break;
        }
      } catch {}
    };
    // Ask notification permission once
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const t = setInterval(check, 30000);
    check();
    return () => clearInterval(t);
  }, []);

  if (!active) return null;
  const color = REMINDER_COLORS[active.type] || '#60a5fa';
  const icon  = REMINDER_ICONS[active.type]  || 'bell';

  return (
    <div className="rounded-2xl px-4 py-4 flex items-center gap-3"
      style={{ background: '#1c1917', border: `1px solid ${color}` }}>
      <Icon name={icon} size={22} color={color} />
      <div className="flex-1">
        <p className="text-sm font-bold" style={{ color: '#ffffff' }}>Reminder</p>
        <p className="text-base font-semibold mt-0.5" style={{ color }}>{active.label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted,#888)' }}>{active.time}</p>
      </div>
      <button onClick={() => setActive(null)} className="p-1">
        <Icon name="x" size={18} color="var(--text-muted,#888)" />
      </button>
    </div>
  );
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function LocationBanner({ homeAddress, homeGps }) {
  const [awayBanner, setAwayBanner] = useState(null);

  useEffect(() => {
    if (!homeGps || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const dist = haversineKm(pos.coords.latitude, pos.coords.longitude, homeGps.lat, homeGps.lng);
      if (dist > 0.3) {
        setAwayBanner(dist);
      }
    }, () => {});
  }, [homeGps]);

  if (!awayBanner) return null;

  const mapsUrl = homeAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(homeAddress)}&travelmode=walking`
    : `https://www.google.com/maps/dir/?api=1&destination=${homeGps.lat},${homeGps.lng}&travelmode=walking`;

  return (
    <div className="rounded-2xl px-4 py-4 flex items-start gap-3"
      style={{ background: '#7c2d12', border: '1px solid #ea580c' }}>
      <Icon name="map-pin" size={20} color="#fb923c" />
      <div className="flex-1">
        <p className="text-base font-bold" style={{ color: '#ffffff' }}>You are away from home</p>
        <p className="text-sm mt-0.5" style={{ color: '#fed7aa' }}>
          Looks like you're about {Math.round(awayBanner * 1000)}m from home. I can safely navigate you back.
        </p>
        <a href={mapsUrl} target="_blank" rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold"
          style={{ background: '#ea580c', color: '#ffffff' }}>
          <Icon name="navigation" size={16} color="#ffffff" />
          Navigate me home
        </a>
      </div>
    </div>
  );
}

function DashboardContent({ cameras, onRefreshCameras }) {
  const { latestEvents, activeAlerts, setActiveAlerts } = useSSE();
  const { speak, autoSpeak, setAutoSpeak, lastMessage } = useTTS();
  const [performance, setPerformance] = useState(null);
  const [patients, setPatients] = useState([]);
  const [emergencyClicked, setEmergencyClicked] = useState(false);
  const [emergencyNumber, setEmergencyNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [homeGps, setHomeGps] = useState(null);
  const [caregiverNumber, setCaregiverNumber] = useState('');

  useEffect(() => {
    get('/patients').then(list => {
      setPatients(list || []);
      if (list?.[0]) get(`/patients/${list[0].id}/performance`).then(setPerformance).catch(() => {});
    }).catch(() => {});
    try {
      setEmergencyNumber(localStorage.getItem('emergency-number') || '');
      setCaregiverNumber(localStorage.getItem('staysync-caregiver-number') || '');
      // Read home from new locations array, fall back to legacy keys
      const locs = JSON.parse(localStorage.getItem('staysync-locations') || '[]');
      const home = locs.find(l => l.isHome) || null;
      setHomeAddress(home?.address || localStorage.getItem('staysync-home-address') || '');
      const gpsRaw = home?.gps ? JSON.stringify(home.gps) : localStorage.getItem('staysync-home-gps');
      if (gpsRaw) { try { setHomeGps(JSON.parse(gpsRaw)); } catch {} }
    } catch {}
  }, []);

  const dismissAlert = (id) => setActiveAlerts(prev => prev.filter(a => a.id !== id));

  const handleHelp = () => {
    // Open the AI assistant bottom sheet
    window.dispatchEvent(new CustomEvent('open-ai-assistant'));
    // Speak a reassurance message after a short delay
    setTimeout(() => speakText("I'm here with you. Tell me what you need, or press Emergency to call for help."), 600);
  };

  const handleEmergency = () => {
    speakText("Calling emergency services. Please stay calm.");
    setEmergencyClicked(true);
    setTimeout(() => setEmergencyClicked(false), 5000);
    const num = emergencyNumber || '911';
    window.location.href = `tel:${num.replace(/\s/g, '')}`;
  };

  return (
    <div className="min-h-screen p-4 pb-24 space-y-5" style={{ background: 'var(--bg,#000)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="w-8 h-8 object-contain rounded-xl"
            onError={e => { e.currentTarget.style.display = 'none'; }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text,#fff)' }}>StaySync</h1>
        </div>
        <button onClick={() => setAutoSpeak(v => !v)}
          className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors
            ${autoSpeak ? 'border-blue-600 text-blue-400' : 'border-[#333] text-[#555]'}`}>
          <Icon name={autoSpeak ? 'volume' : 'volume-off'} size={15} />
          {autoSpeak ? 'Voice On' : 'Voice Off'}
        </button>
      </div>

      <AlertBanner alerts={activeAlerts} onDismiss={dismissAlert} />

      <ReminderBanner />
      <LocationBanner homeAddress={homeAddress} homeGps={homeGps} />

      {performance && <RiskScoreBar score={performance.fallRisk} />}

      {/* Voice Guidance Card */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface,#111)', borderColor: 'var(--border,#222)' }}>
        <div className="flex items-center gap-2">
          <Icon name="volume" size={18} className="text-blue-400" />
          <span className="text-base font-bold" style={{ color: 'var(--text,#fff)' }}>Voice Guidance</span>
        </div>

        {lastMessage
          ? <p className="text-base leading-relaxed" style={{ color: 'var(--text,#fff)' }}>{lastMessage}</p>
          : <p className="text-sm" style={{ color: 'var(--text-muted,#888)' }}>AI guidance will appear here when cameras detect activity.</p>
        }

        {/* Help & Emergency — always visible */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleHelp}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-orange-500 active:scale-95 transition-transform"
            style={{ color: '#ffffff' }}>
            <Icon name="bell" size={24} color="#ffffff" />
            I Need Help
          </button>
          <button onClick={handleEmergency}
            className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl active:scale-95 transition-transform
              ${emergencyClicked ? 'bg-red-800' : 'bg-red-600'}`}
            style={{ color: '#ffffff' }}>
            <Icon name="phone" size={24} color="#ffffff" />
            {emergencyClicked ? 'Calling...' : 'Emergency'}
          </button>
        </div>

        {/* Caregiver alert */}
        {caregiverNumber && (
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/${caregiverNumber.replace(/[\s+\-()]/g, '')}?text=${encodeURIComponent(`Hi, I need assistance. StaySync alert sent at ${new Date().toLocaleTimeString()}.`)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#15803d', color: '#ffffff' }}>
              <Icon name="whatsapp" size={16} color="#ffffff" />
              WhatsApp
            </a>
            <a href={`sms:${caregiverNumber}?body=${encodeURIComponent('Hi, I need assistance. StaySync alert.')}`}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#1d4ed8', color: '#ffffff' }}>
              <Icon name="message" size={16} color="#ffffff" />
              Send SMS
            </a>
          </div>
        )}
      </div>

      {/* Memories */}
      <MemoriesCard />

      {/* Suggestion cards */}
      <SuggestionCards
        events={latestEvents}
        alerts={activeAlerts}
        patients={patients}
      />

      {/* Camera Intelligence Card */}
      <CameraIntelCard
        cameras={cameras}
        latestEvents={latestEvents}
        onRefresh={onRefreshCameras}
        onSpeak={speak}
      />
    </div>
  );
}

function loadLocalCams() {
  try { return JSON.parse(localStorage.getItem('staysync-local-cameras') || '[]'); } catch { return []; }
}

export default function DashboardPage() {
  const [cameras, setCameras] = useState([]);

  const loadCameras = useCallback(() => {
    const local = loadLocalCams();
    get('/cameras')
      .then(remote => {
        const remoteIds = new Set(remote.map(c => c.id));
        setCameras([...remote, ...local.filter(c => !remoteIds.has(c.id))]);
      })
      .catch(() => setCameras(local));
  }, []);

  useEffect(() => {
    loadCameras();
    const interval = setInterval(loadCameras, 10000);
    return () => clearInterval(interval);
  }, [loadCameras]);

  return (
    <SSEProvider cameraIds={cameras.map(c => c.id)}>
      <DashboardContent cameras={cameras} onRefreshCameras={loadCameras} />
    </SSEProvider>
  );
}
