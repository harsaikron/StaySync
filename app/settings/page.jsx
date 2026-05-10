'use client';
import { useState, useEffect } from 'react';
import { speakText } from '@/lib/tts';
import Icon from '@/components/Icon';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDay(ts) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const REM_TYPES = [
  { id: 'medicine', icon: 'shield', color: '#f97316', label: 'Medicine' },
  { id: 'food',     icon: 'clock',  color: '#22c55e', label: 'Meal'    },
  { id: 'sleep',    icon: 'moon',   color: '#8b5cf6', label: 'Sleep'   },
  { id: 'other',    icon: 'bell',   color: '#60a5fa', label: 'Other'   },
];

const DEFAULT_REMINDERS = [
  { id: 'r1', label: 'Morning tablets',  time: '08:00', type: 'medicine', enabled: true },
  { id: 'r2', label: 'Breakfast',        time: '08:30', type: 'food',     enabled: true },
  { id: 'r3', label: 'Lunch',            time: '13:00', type: 'food',     enabled: true },
  { id: 'r4', label: 'Dinner',           time: '18:30', type: 'food',     enabled: true },
  { id: 'r5', label: 'Evening tablets',  time: '20:00', type: 'medicine', enabled: true },
  { id: 'r6', label: 'Bedtime',          time: '22:00', type: 'sleep',    enabled: true },
];

export default function SettingsPage() {
  // Core settings
  const [theme,          setThemeState]      = useState('dark');
  const [autoSpeak,      setAutoSpeakState]  = useState(true);
  const [voiceRate,      setVoiceRate]       = useState(0.82);
  const [voicePitch,     setVoicePitch]      = useState(1.05);
  const [emergencyNumber,setEmergencyNumber] = useState('');
  const [backendUrl,     setBackendUrl]      = useState('');
  const [captureInterval,setCaptureInterval] = useState(5);
  const [caregiverNumber,setCaregiverNumber] = useState('');
  const [caregiverName,  setCaregiverName]   = useState('');
  const [saved,          setSaved]           = useState(false);

  // Locations
  const [locations,       setLocations]      = useState([]);
  const [showAddLoc,      setShowAddLoc]     = useState(false);
  const [newLoc,          setNewLoc]         = useState({ name: '', address: '', isHome: false });
  const [gpsStatus,       setGpsStatus]      = useState({});

  // Reminders
  const [reminders,       setReminders]      = useState([]);
  const [showAddRem,      setShowAddRem]     = useState(false);
  const [newRem,          setNewRem]         = useState({ label: '', time: '08:00', type: 'medicine' });

  // Activity log
  const [activityLog,     setActivityLog]    = useState([]);

  useEffect(() => {
    try {
      setThemeState(localStorage.getItem('staysync-theme') || 'dark');
      const as = localStorage.getItem('tts-autospeak');
      if (as !== null) setAutoSpeakState(as !== 'false');
      const r = localStorage.getItem('tts-rate');   if (r) setVoiceRate(parseFloat(r));
      const p = localStorage.getItem('tts-pitch');  if (p) setVoicePitch(parseFloat(p));
      setEmergencyNumber(localStorage.getItem('emergency-number') || '');
      setBackendUrl(localStorage.getItem('staysync-backend-url') || '');
      setCaptureInterval(parseInt(localStorage.getItem('camera-capture-interval') || '5', 10));
      setCaregiverNumber(localStorage.getItem('staysync-caregiver-number') || '');
      setCaregiverName(localStorage.getItem('staysync-caregiver-name') || '');

      // Locations — migrate old single home address if needed
      const savedLocs = localStorage.getItem('staysync-locations');
      if (savedLocs) {
        setLocations(JSON.parse(savedLocs));
      } else {
        const oldAddr = localStorage.getItem('staysync-home-address');
        const oldGps  = localStorage.getItem('staysync-home-gps');
        if (oldAddr || oldGps) {
          const migrated = [{ id: 'home', name: 'Home', address: oldAddr || '', gps: oldGps ? JSON.parse(oldGps) : null, isHome: true }];
          setLocations(migrated);
          localStorage.setItem('staysync-locations', JSON.stringify(migrated));
        }
      }

      // Reminders
      const savedRem = localStorage.getItem('staysync-reminders');
      setReminders(savedRem ? JSON.parse(savedRem) : DEFAULT_REMINDERS);

      // Activity log
      setActivityLog(JSON.parse(localStorage.getItem('staysync-activity-log') || '[]'));
    } catch {}
  }, []);

  // ---- save helpers ----
  const saveLocs = (locs) => {
    setLocations(locs);
    try {
      localStorage.setItem('staysync-locations', JSON.stringify(locs));
      const home = locs.find(l => l.isHome);
      if (home?.address) localStorage.setItem('staysync-home-address', home.address);
      if (home?.gps)     localStorage.setItem('staysync-home-gps', JSON.stringify(home.gps));
    } catch {}
  };

  const saveRems = (rems) => {
    setReminders(rems);
    try { localStorage.setItem('staysync-reminders', JSON.stringify(rems)); } catch {}
  };

  const applyTheme = (t) => {
    setThemeState(t);
    try {
      localStorage.setItem('staysync-theme', t);
      document.documentElement.setAttribute('data-theme', t);
    } catch {}
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('staysync-theme',            theme);
      localStorage.setItem('tts-autospeak',             String(autoSpeak));
      localStorage.setItem('tts-rate',                  String(voiceRate));
      localStorage.setItem('tts-pitch',                 String(voicePitch));
      localStorage.setItem('emergency-number',          emergencyNumber);
      localStorage.setItem('staysync-backend-url',      backendUrl.trim().replace(/\/$/, ''));
      localStorage.setItem('camera-capture-interval',   String(captureInterval));
      localStorage.setItem('staysync-caregiver-number', caregiverNumber.trim());
      localStorage.setItem('staysync-caregiver-name',   caregiverName.trim());
      document.documentElement.setAttribute('data-theme', theme);
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testVoice = () => speakText("Hello! I'm your StaySync care companion. Voice is working perfectly.", { rate: voiceRate, pitch: voicePitch });

  // ---- location helpers ----
  const addLocation = () => {
    if (!newLoc.name.trim()) return;
    const setAsHome = newLoc.isHome || locations.length === 0;
    const loc = { id: `loc-${Date.now()}`, name: newLoc.name.trim(), address: newLoc.address.trim(), gps: null, isHome: setAsHome };
    const updated = setAsHome ? [...locations.map(l => ({ ...l, isHome: false })), loc] : [...locations, loc];
    saveLocs(updated);
    setNewLoc({ name: '', address: '', isHome: false });
    setShowAddLoc(false);
  };

  const deleteLocation = (id) => saveLocs(locations.filter(l => l.id !== id));

  const setAsHome = (id) => saveLocs(locations.map(l => ({ ...l, isHome: l.id === id })));

  const pinGps = (locId) => {
    if (!navigator.geolocation) { setGpsStatus(s => ({ ...s, [locId]: 'GPS not supported' })); return; }
    setGpsStatus(s => ({ ...s, [locId]: 'Getting location…' }));
    navigator.geolocation.getCurrentPosition(
      pos => {
        const gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveLocs(locations.map(l => l.id === locId ? { ...l, gps } : l));
        setGpsStatus(s => ({ ...s, [locId]: `Pinned ✓ ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` }));
      },
      () => setGpsStatus(s => ({ ...s, [locId]: 'Location permission denied' })),
    );
  };

  // ---- reminder helpers ----
  const toggleReminder = (id) => saveRems(reminders.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  const deleteReminder  = (id) => saveRems(reminders.filter(r => r.id !== id));
  const addReminder = () => {
    if (!newRem.label.trim() || !newRem.time) return;
    saveRems([...reminders, { id: `rem-${Date.now()}`, ...newRem, label: newRem.label.trim(), enabled: true }]);
    setNewRem({ label: '', time: '08:00', type: 'medicine' });
    setShowAddRem(false);
  };

  const iStyle = { background: 'var(--surface-deep,#0a0a0a)', borderColor: 'var(--border,#333)', color: 'var(--text,#fff)' };
  const sortedRem = [...reminders].sort((a, b) => a.time.localeCompare(b.time));
  const groupedLog = activityLog.reduce((acc, e) => {
    const k = formatDay(e.ts);
    (acc[k] = acc[k] || []).push(e);
    return acc;
  }, {});

  return (
    <div className="min-h-screen p-4 pb-24 space-y-5" style={{ background: 'var(--bg,#000)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="w-9 h-9 object-contain rounded-xl"
          onError={e => { e.currentTarget.style.display = 'none'; }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text,#fff)' }}>Settings</h1>
      </div>

      {/* Appearance */}
      <Card>
        <SH icon="sun" label="Appearance" />
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted,#888)' }}>Theme</p>
        <div className="grid grid-cols-2 gap-3">
          {[{ v: 'dark', label: 'Dark', icon: 'moon' }, { v: 'light', label: 'Light', icon: 'sun' }].map(opt => (
            <button key={opt.v} onClick={() => applyTheme(opt.v)}
              className="py-4 rounded-xl border flex flex-col items-center gap-2 text-sm font-semibold transition-colors"
              style={{
                background: theme === opt.v ? '#2563eb' : 'transparent',
                borderColor: theme === opt.v ? '#2563eb' : 'var(--border,#333)',
                color: theme === opt.v ? '#ffffff' : 'var(--text-muted,#555)',
              }}>
              <Icon name={opt.icon} size={22} color={theme === opt.v ? '#ffffff' : 'var(--text-muted,#555)'} />
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Emergency */}
      <Card>
        <SH icon="phone" label="Emergency Contact" />
        <p className="text-sm mb-2" style={{ color: 'var(--text-muted,#888)' }}>Emergency phone number</p>
        <input type="tel" value={emergencyNumber} onChange={e => setEmergencyNumber(e.target.value)}
          placeholder="e.g. 999 or +44 7700 900000"
          className="w-full rounded-xl px-4 py-3 text-base outline-none border" style={iStyle} />
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted,#666)' }}>
          Called when you press Emergency on the home screen.
        </p>
        {emergencyNumber && (
          <a href={`tel:${emergencyNumber.replace(/\s/g, '')}`}
            className="mt-3 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#dc2626', color: '#ffffff' }}>
            <Icon name="phone" size={16} color="#ffffff" />
            Test Call {emergencyNumber}
          </a>
        )}
      </Card>

      {/* Voice */}
      <Card>
        <SH icon="volume" label="Voice" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text,#fff)' }}>Auto-speak guidance</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted,#888)' }}>Announce AI guidance automatically</p>
          </div>
          <button onClick={() => setAutoSpeakState(v => !v)}
            className="w-12 h-7 rounded-full relative transition-colors"
            style={{ background: autoSpeak ? '#2563eb' : '#333' }}>
            <span className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: autoSpeak ? '1.375rem' : '0.25rem' }} />
          </button>
        </div>
        <Slider label="Speech speed" value={voiceRate} min={0.5} max={1.5} step={0.05}
          display={`${voiceRate.toFixed(2)}×`} leftLabel="Slow" rightLabel="Fast" onChange={setVoiceRate} />
        <Slider label="Voice pitch" value={voicePitch} min={0.5} max={2.0} step={0.05}
          display={voicePitch.toFixed(2)} leftLabel="Lower" rightLabel="Higher" onChange={setVoicePitch} />
        <button onClick={testVoice}
          className="w-full mt-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: '#2563eb', color: '#ffffff' }}>
          <Icon name="volume" size={16} color="#ffffff" /> Test Voice
        </button>
      </Card>

      {/* Camera */}
      <Card>
        <SH icon="camera" label="Camera" />

        {/* Backend URL input */}
        <div>
          <p className="text-sm mb-1.5" style={{ color: 'var(--text-muted,#888)' }}>Backend server URL</p>
          <input type="url" value={backendUrl} onChange={e => setBackendUrl(e.target.value)}
            placeholder="https://your-backend.railway.app"
            className="w-full rounded-xl px-4 py-3 text-base outline-none border" style={iStyle} />
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted,#666)' }}>
            Where your StaySync backend is running. Cameras upload frames here for Gemma 4 AI analysis.
          </p>
        </div>

        {/* What URL to enter — guide */}
        <BackendUrlGuide currentUrl={backendUrl} />

        <Slider label="Photo capture interval" value={captureInterval} min={3} max={60} step={1}
          display={`${captureInterval}s`} leftLabel="3s (frequent)" rightLabel="60s (battery saving)"
          onChange={setCaptureInterval} />
      </Card>

      {/* Locations */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <SH icon="map-pin" label="Locations" />
          <button onClick={() => setShowAddLoc(v => !v)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
            style={{ background: '#2563eb', color: '#ffffff' }}>
            <Icon name="plus" size={13} color="#ffffff" /> Add
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted,#666)' }}>
          Save named places — Home, Pharmacy, Park, Daughter's house. The app alerts when patient is away from the Home location.
        </p>

        {showAddLoc && (
          <div className="rounded-xl p-4 space-y-3 mb-3"
            style={{ background: 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#333)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text,#fff)' }}>New location</p>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted,#888)' }}>Name</p>
              <input value={newLoc.name} onChange={e => setNewLoc(n => ({ ...n, name: e.target.value }))}
                placeholder="Home · Pharmacy · Park · Daughter's house"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border" style={iStyle} />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted,#888)' }}>Address (optional — used for Google Maps)</p>
              <input value={newLoc.address} onChange={e => setNewLoc(n => ({ ...n, address: e.target.value }))}
                placeholder="12 Oak Street, London, UK"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border" style={iStyle} />
            </div>
            <button onClick={() => setNewLoc(n => ({ ...n, isHome: !n.isHome }))}
              className="flex items-center gap-2 text-sm">
              <span className="w-4 h-4 rounded border flex items-center justify-center"
                style={{ borderColor: newLoc.isHome ? '#22c55e' : '#555', background: newLoc.isHome ? '#22c55e' : 'transparent' }}>
                {newLoc.isHome && <Icon name="check" size={10} color="#fff" />}
              </span>
              <span style={{ color: newLoc.isHome ? '#22c55e' : 'var(--text-muted,#888)' }}>Mark as Home location</span>
            </button>
            <div className="flex gap-2">
              <button onClick={addLocation}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#2563eb', color: '#ffffff' }}>Save Location</button>
              <button onClick={() => setShowAddLoc(false)}
                className="py-2.5 px-4 rounded-xl text-sm"
                style={{ border: '1px solid var(--border,#333)', color: 'var(--text-muted,#888)' }}>Cancel</button>
            </div>
          </div>
        )}

        {locations.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted,#555)' }}>No locations saved — tap Add to get started</p>
        ) : (
          <div className="space-y-2">
            {locations.map(loc => (
              <div key={loc.id} className="rounded-xl p-3 space-y-2"
                style={{ background: 'var(--surface-deep,#0a0a0a)', border: `1px solid ${loc.isHome ? '#15803d' : 'var(--border,#333)'}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon name="map-pin" size={15} color={loc.isHome ? '#22c55e' : '#60a5fa'} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text,#fff)' }}>{loc.name}</span>
                    {loc.isHome && <Badge color="#052e16" text="#4ade80" label="Home" />}
                    {loc.gps   && <Badge color="#0f172a" text="#93c5fd" label="GPS ✓" />}
                  </div>
                  <button onClick={() => deleteLocation(loc.id)}>
                    <Icon name="x" size={15} color="#ef4444" />
                  </button>
                </div>
                {loc.address && (
                  <p className="text-xs pl-5" style={{ color: 'var(--text-muted,#888)' }}>{loc.address}</p>
                )}
                {gpsStatus[loc.id] && (
                  <p className="text-xs pl-5" style={{ color: gpsStatus[loc.id].startsWith('Pinned') ? '#22c55e' : '#f87171' }}>
                    {gpsStatus[loc.id]}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <SmBtn onClick={() => pinGps(loc.id)} icon="map-pin" color="#60a5fa"
                    label={loc.gps ? 'Re-pin GPS' : 'Pin my GPS here'} />
                  {!loc.isHome && <SmBtn onClick={() => setAsHome(loc.id)} icon="check" color="#4ade80" label="Set as Home" />}
                  {loc.address && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}&travelmode=walking`}
                      target="_blank" rel="noreferrer"
                      className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                      style={{ border: '1px solid var(--border,#333)', color: 'var(--text-muted,#888)' }}>
                      <Icon name="navigation" size={11} color="var(--text-muted,#888)" /> Maps
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Caregiver Alerts */}
      <Card>
        <SH icon="message" label="Caregiver Alerts" />
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted,#666)' }}>
          WhatsApp and SMS buttons appear on the home screen so the patient can alert their carer instantly.
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-sm mb-1.5" style={{ color: 'var(--text-muted,#888)' }}>Caregiver name</p>
            <input type="text" value={caregiverName} onChange={e => setCaregiverName(e.target.value)}
              placeholder="e.g. Sarah (Daughter)"
              className="w-full rounded-xl px-4 py-3 text-base outline-none border" style={iStyle} />
          </div>
          <div>
            <p className="text-sm mb-1.5" style={{ color: 'var(--text-muted,#888)' }}>Phone number</p>
            <input type="tel" value={caregiverNumber} onChange={e => setCaregiverNumber(e.target.value)}
              placeholder="+44 7700 900000"
              className="w-full rounded-xl px-4 py-3 text-base outline-none border" style={iStyle} />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted,#666)' }}>Include country code (+44, +1, +91…)</p>
          </div>
          {caregiverNumber && (
            <div className="grid grid-cols-2 gap-2">
              <a href={`https://wa.me/${caregiverNumber.replace(/[\s+\-()]/g, '')}?text=${encodeURIComponent('Test alert from StaySync care app — all is well.')}`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#15803d', color: '#ffffff' }}>
                <Icon name="whatsapp" size={15} color="#ffffff" /> Test WhatsApp
              </a>
              <a href={`sms:${caregiverNumber}?body=${encodeURIComponent('Test alert from StaySync.')}`}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#1d4ed8', color: '#ffffff' }}>
                <Icon name="message" size={15} color="#ffffff" /> Test SMS
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* Care Reminders */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <SH icon="clock" label="Care Reminders" />
          <button onClick={() => setShowAddRem(v => !v)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
            style={{ background: '#2563eb', color: '#ffffff' }}>
            <Icon name="plus" size={13} color="#ffffff" /> Add
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted,#666)' }}>
          Daily voice + notification alerts for medicine, meals, and sleep.
        </p>

        {showAddRem && (
          <div className="rounded-xl p-4 space-y-3 mb-3"
            style={{ background: 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#333)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text,#fff)' }}>New reminder</p>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted,#888)' }}>Label</p>
              <input value={newRem.label} onChange={e => setNewRem(n => ({ ...n, label: e.target.value }))}
                placeholder="e.g. Morning tablets, Lunch, Walk in the park"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border" style={iStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted,#888)' }}>Time</p>
                <input type="time" value={newRem.time} onChange={e => setNewRem(n => ({ ...n, time: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border" style={iStyle} />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted,#888)' }}>Type</p>
                <select value={newRem.type} onChange={e => setNewRem(n => ({ ...n, type: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border" style={iStyle}>
                  {REM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addReminder}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#2563eb', color: '#ffffff' }}>Save Reminder</button>
              <button onClick={() => setShowAddRem(false)}
                className="py-2.5 px-4 rounded-xl text-sm"
                style={{ border: '1px solid var(--border,#333)', color: 'var(--text-muted,#888)' }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {sortedRem.map(r => {
            const t = REM_TYPES.find(x => x.id === r.type) || REM_TYPES[3];
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-3"
                style={{ background: 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#222)' }}>
                <Icon name={t.icon} size={16} color={r.enabled ? t.color : '#444'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: r.enabled ? 'var(--text,#fff)' : 'var(--text-muted,#555)' }}>
                    {r.label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted,#888)' }}>{r.time} · daily</p>
                </div>
                <button onClick={() => toggleReminder(r.id)}
                  className="w-11 h-6 rounded-full relative transition-colors shrink-0"
                  style={{ background: r.enabled ? t.color : '#333' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                    style={{ left: r.enabled ? '1.25rem' : '0.125rem' }} />
                </button>
                <button onClick={() => deleteReminder(r.id)} className="p-1 ml-1">
                  <Icon name="x" size={14} color="#ef4444" />
                </button>
              </div>
            );
          })}
          {reminders.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted,#555)' }}>No reminders — tap Add</p>
          )}
        </div>
      </Card>

      {/* Activity Log */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <SH icon="clipboard" label="Activity Log (24h)" />
          <button
            onClick={() => setActivityLog(JSON.parse(localStorage.getItem('staysync-activity-log') || '[]'))}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
            style={{ border: '1px solid var(--border,#333)', color: '#60a5fa' }}>
            <Icon name="refresh" size={13} color="#60a5fa" /> Refresh
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted,#666)' }}>
          AI observations from cameras over the last 24 hours. Timestamps, activity, and location — no photos stored.
        </p>

        {activityLog.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted,#555)' }}>
            <Icon name="clipboard" size={30} color="var(--text-muted,#444)" />
            <p className="text-sm mt-2">No activity yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted,#666)' }}>Start a camera and let Gemma 4 observe</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedLog).map(([day, entries]) => (
              <div key={day}>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted,#888)' }}>{day}</p>
                <div className="space-y-2">
                  {entries.map(entry => (
                    <div key={entry.id} className="flex gap-3 rounded-xl p-3"
                      style={{ background: 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#222)' }}>
                      <div className="shrink-0 text-right" style={{ minWidth: 52 }}>
                        <p className="text-xs font-mono font-semibold" style={{ color: '#60a5fa' }}>{formatTime(entry.ts)}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted,#555)' }}>
                          {(entry.camId || '').replace('browser-', '')}
                        </p>
                      </div>
                      <p className="text-sm leading-snug flex-1" style={{ color: 'var(--text,#fff)' }}>{entry.guidance}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                if (!confirm('Clear all activity data?')) return;
                localStorage.removeItem('staysync-activity-log');
                setActivityLog([]);
              }}
              className="w-full py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid #7f1d1d', color: '#f87171' }}>
              Clear Activity Log
            </button>
          </div>
        )}
      </Card>

      {/* AI */}
      <Card>
        <SH icon="bot" label="AI" />
        <div className="rounded-xl border px-4 py-3 flex items-center gap-3 mb-3"
          style={{ borderColor: 'var(--border,#222)' }}>
          <Icon name="bot" size={20} color="#60a5fa" />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text,#fff)' }}>Powered by Gemma 4</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted,#888)' }}>gemma4:e4b · Local Ollama</p>
          </div>
        </div>
        <a href="/feedback"
          className="flex items-center justify-between py-3 px-4 rounded-xl border"
          style={{ borderColor: 'var(--border,#222)' }}>
          <div className="flex items-center gap-2">
            <Icon name="lightbulb" size={16} color="#f97316" />
            <span className="text-sm font-medium" style={{ color: 'var(--text,#fff)' }}>AI Feedback & Auto-Evolve</span>
          </div>
          <Icon name="chevron-right" size={16} color="var(--text-muted,#888)" />
        </a>
      </Card>

      {/* Save */}
      <button onClick={saveSettings}
        className="w-full py-3.5 rounded-2xl text-base font-bold flex items-center justify-center gap-2"
        style={{ background: '#2563eb', color: '#ffffff' }}>
        <Icon name={saved ? 'check' : 'save'} size={18} color="#ffffff" />
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}

function BackendUrlGuide({ currentUrl }) {
  const [open, setOpen] = useState(false);
  const isLocalhost = currentUrl && (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1'));
  const isEmpty = !currentUrl.trim();

  const scenarios = [
    {
      icon: 'monitor',
      title: 'Option A — Deploy to Railway (recommended)',
      color: '#7c3aed',
      tag: 'Free tier available',
      steps: [
        'Go to railway.app and create a free account',
        'Click "New Project" → "Deploy from GitHub repo"',
        'Connect your StaySync backend repo',
        'After deploy, copy the URL shown (e.g. https://staysync-production.up.railway.app)',
        'Paste that URL here',
      ],
      note: 'This URL never changes — works for both browser cameras AND ESP32-CAM.',
    },
    {
      icon: 'wifi',
      title: 'Option B — Same WiFi (local network)',
      color: '#059669',
      tag: 'No internet needed',
      steps: [
        'Run the backend on your Mac/PC: npm start (port 3001)',
        'Find your Mac IP: System Settings → Wi-Fi → click your network',
        'Or run in Terminal: ipconfig getifaddr en0',
        'Enter: http://192.168.1.X:3001 (replace X with your number)',
        'Your phone/camera must be on the SAME WiFi',
      ],
      note: 'Only works when all devices are on the same home WiFi. IP may change if you reconnect.',
    },
    {
      icon: 'plug',
      title: 'Option C — Cloudflare Tunnel (temporary)',
      color: '#d97706',
      tag: 'URL changes each restart',
      steps: [
        'Install: npm install -g cloudflared',
        'Run: cloudflared tunnel --url http://localhost:3001',
        'Copy the https://xyz-abc.trycloudflare.com URL it prints',
        'Paste that URL here',
        '⚠️ URL changes every time you restart — you must re-flash ESP32-CAM each time',
      ],
      note: 'Good for testing. Not reliable long-term — use Railway for a permanent URL.',
    },
  ];

  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm"
        style={{
          background: isEmpty || isLocalhost ? '#fef3c7' : 'var(--surface-deep,#0a0a0a)',
          border: `1px solid ${isEmpty || isLocalhost ? '#d97706' : 'var(--border,#333)'}`,
        }}>
        <div className="flex items-center gap-2">
          <Icon name="info" size={15} color={isEmpty || isLocalhost ? '#d97706' : 'var(--blue,#1d4ed8)'} />
          <span className="font-semibold" style={{ color: isEmpty || isLocalhost ? '#92400e' : 'var(--text,#fff)' }}>
            {isEmpty
              ? 'No backend URL set — tap to learn what to enter'
              : isLocalhost
              ? 'localhost won\'t work on cameras — tap to fix'
              : 'What is the backend URL?'}
          </span>
        </div>
        <Icon name={open ? 'x' : 'chevron-right'} size={14} color="var(--text-muted,#888)" />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* What is it */}
          <div className="rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text,#fff)' }}>What is the backend URL?</p>
            <p style={{ color: 'var(--text-muted,#888)' }}>
              StaySync has a server (backend) that receives camera frames and runs Gemma 4 AI analysis.
              This URL is the address of that server. Your browser camera, phone camera, and ESP32-CAM
              all send their frames to this URL.
            </p>
          </div>

          {/* Scenario cards */}
          {scenarios.map((s, i) => (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ border: `1px solid var(--border,#222)` }}>
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ background: `${s.color}18`, borderBottom: '1px solid var(--border,#222)' }}>
                <div className="flex items-center gap-2">
                  <Icon name={s.icon} size={15} color={s.color} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text,#fff)' }}>{s.title}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${s.color}22`, color: s.color }}>{s.tag}</span>
              </div>
              <div className="px-4 py-3 space-y-2" style={{ background: 'var(--surface-deep,#0a0a0a)' }}>
                <ol className="space-y-1">
                  {s.steps.map((step, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: `${s.color}22`, color: s.color }}>
                        {j + 1}
                      </span>
                      <span style={{ color: 'var(--text-muted,#aaa)' }}>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs pt-1" style={{ color: s.color }}>💡 {s.note}</p>
              </div>
            </div>
          ))}

          {/* Quick example */}
          <div className="rounded-xl px-4 py-3 space-y-1.5"
            style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted,#888)' }}>
              EXAMPLE URLS
            </p>
            {[
              { label: 'Railway deploy',    url: 'https://staysync-production.up.railway.app' },
              { label: 'Local WiFi (Mac)',  url: 'http://192.168.1.42:3001' },
              { label: 'Render deploy',     url: 'https://staysync.onrender.com' },
            ].map(ex => (
              <div key={ex.label} className="flex items-center gap-2">
                <span className="text-xs w-32 shrink-0" style={{ color: 'var(--text-muted,#666)' }}>{ex.label}</span>
                <code className="text-xs px-2 py-1 rounded flex-1 truncate"
                  style={{ background: 'var(--surface-deep,#0a0a0a)', color: '#60a5fa', border: '1px solid var(--border,#222)' }}>
                  {ex.url}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ children }) {
  return (
    <section className="rounded-2xl border p-5 space-y-4"
      style={{ background: 'var(--surface,#111)', borderColor: 'var(--border,#222)' }}>
      {children}
    </section>
  );
}

function SH({ icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon name={icon} size={18} color="var(--text,#fff)" />
      <span className="text-base font-bold" style={{ color: 'var(--text,#fff)' }}>{label}</span>
    </div>
  );
}

function Badge({ color, text, label }) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{ background: color, color: text }}>{label}</span>
  );
}

function SmBtn({ onClick, icon, color, label }) {
  return (
    <button onClick={onClick}
      className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1"
      style={{ border: `1px solid ${color}33`, color }}>
      <Icon name={icon} size={11} color={color} />
      {label}
    </button>
  );
}

function Slider({ label, value, min, max, step, display, leftLabel, rightLabel, onChange }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm" style={{ color: 'var(--text-muted,#888)' }}>{label}</span>
        <span className="text-sm font-medium" style={{ color: '#60a5fa' }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500" />
      <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted,#888)' }}>
        <span>{leftLabel}</span><span>{rightLabel}</span>
      </div>
    </div>
  );
}
