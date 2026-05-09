'use client';
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function CameraCard({ camera }) {
  const [ts, setTs] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTs(Date.now()), 3000);
    return () => clearInterval(interval);
  }, []);

  const src = `${BASE}/stream-snapshot/${camera.id}?t=${ts}`;

  return (
    <div className="bg-[#21262d] rounded-lg overflow-hidden">
      <div className="aspect-video bg-[#161b22] flex items-center justify-center relative">
        <img src={src} alt={camera.name} className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }} />
        <span className="text-4xl absolute">📷</span>
      </div>
      <div className="p-2 flex items-center justify-between">
        <span className="text-sm font-medium">{camera.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${camera.online
          ? 'bg-[#238636] text-white' : 'bg-[#30363d] text-[#8b949e]'}`}>
          {camera.online ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
    </div>
  );
}

export default function CameraGrid({ cameras }) {
  if (!cameras?.length) return (
    <div className="text-[#8b949e] text-center py-8">No cameras registered yet</div>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {cameras.map(c => <CameraCard key={c.id} camera={c} />)}
    </div>
  );
}
