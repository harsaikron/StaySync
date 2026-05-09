'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STORAGE_KEY = (id) => `camera-paused-${id}`;

function CameraCard({ camera, onRefresh }) {
  const [ts, setTs] = useState(Date.now());
  const [imgOk, setImgOk] = useState(false);
  const [paused, setPausedState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY(camera.id)) === 'true'; } catch { return false; }
  });

  const setPaused = (val) => {
    setPausedState(val);
    try { localStorage.setItem(STORAGE_KEY(camera.id), String(val)); } catch {}
  };

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => setTs(Date.now()), 3000);
    return () => clearInterval(interval);
  }, [paused]);

  const src = `${BASE}/stream-snapshot/${camera.id}?t=${ts}`;

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
      <div className="aspect-video bg-black flex items-center justify-center relative">
        <img
          key={ts}
          src={src}
          alt={camera.name}
          className="w-full h-full object-cover"
          onLoad={() => setImgOk(true)}
          onError={() => setImgOk(false)}
        />
        {!imgOk && (
          <span className="absolute text-[#333] pointer-events-none">
            <Icon name="camera" size={40} />
          </span>
        )}
        {paused && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white text-sm font-bold tracking-widest">PAUSED</span>
          </div>
        )}
      </div>

      <div className="p-3 flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-white truncate">{camera.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => paused ? (setPaused(false), setTs(Date.now())) : setPaused(true)}
            className={`flex items-center gap-1 text-sm px-2.5 py-1.5 border rounded-lg transition-colors
              ${paused ? 'border-green-700 text-green-400' : 'border-red-800 text-red-400'}`}
          >
            <Icon name={paused ? 'play' : 'stop'} size={14} />
            {paused ? 'Resume' : 'Stop'}
          </button>
          {!paused && (
            <button
              onClick={() => { setTs(Date.now()); onRefresh?.(); }}
              className="p-1.5 border border-[#333] rounded-lg text-[#888] hover:text-white hover:border-[#555]"
            >
              <Icon name="refresh" size={15} />
            </button>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
            ${camera.online ? 'bg-green-900 text-green-400' : 'bg-[#222] text-[#666]'}`}>
            {camera.online ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CameraGrid({ cameras, onRefresh }) {
  if (!cameras?.length) return (
    <div className="text-[#666] text-center py-12 flex flex-col items-center gap-3">
      <Icon name="camera" size={40} />
      <span className="text-base">No cameras registered yet</span>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {cameras.map(c => <CameraCard key={c.id} camera={c} onRefresh={onRefresh} />)}
    </div>
  );
}
