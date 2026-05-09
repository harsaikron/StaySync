'use client';
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function CameraCard({ camera, onRefresh }) {
  const [ts, setTs] = useState(Date.now());
  const [imgOk, setImgOk] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTs(Date.now()), 3000);
    return () => clearInterval(interval);
  }, []);

  const src = `${BASE}/stream-snapshot/${camera.id}?t=${ts}`;

  return (
    <div className="bg-[#21262d] rounded-lg overflow-hidden">
      <div className="aspect-video bg-[#161b22] flex items-center justify-center relative">
        <img
          key={ts}
          src={src}
          alt={camera.name}
          className="w-full h-full object-cover"
          onLoad={() => setImgOk(true)}
          onError={() => setImgOk(false)}
        />
        {!imgOk && (
          <span className="text-4xl absolute pointer-events-none">📷</span>
        )}
      </div>
      <div className="p-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{camera.name}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setTs(Date.now()); onRefresh && onRefresh(); }}
            className="text-[#58a6ff] text-xs px-2 py-1 border border-[#30363d] rounded hover:border-[#58a6ff]"
            title="Refresh"
          >
            ↺ Refresh
          </button>
          <span className={`text-xs px-2 py-0.5 rounded-full ${camera.online
            ? 'bg-[#238636] text-white' : 'bg-[#30363d] text-[#8b949e]'}`}>
            {camera.online ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CameraGrid({ cameras, onRefresh }) {
  if (!cameras?.length) return (
    <div className="text-[#8b949e] text-center py-8">No cameras registered yet</div>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {cameras.map(c => <CameraCard key={c.id} camera={c} onRefresh={onRefresh} />)}
    </div>
  );
}
