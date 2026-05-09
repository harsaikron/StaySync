'use client';
import { useEffect, useState } from 'react';
import { get, del } from '@/lib/api';
import Link from 'next/link';

export default function CamerasPage() {
  const [cameras, setCameras] = useState([]);

  const load = () => get('/cameras').then(setCameras).catch(() => {});
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm('Remove this camera?')) return;
    await del(`/cameras/${id}`);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">📷 Cameras</h1>
        <Link href="/cameras/setup"
          className="bg-[#1f6feb] text-white text-sm px-4 py-2 rounded-lg">
          + Add Camera
        </Link>
      </div>

      {cameras.length === 0 ? (
        <div className="text-center py-16 text-[#8b949e]">
          <div className="text-4xl mb-3">📷</div>
          <p>No cameras yet.</p>
          <Link href="/cameras/setup" className="text-[#58a6ff] text-sm mt-2 block">
            Add your first camera →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cameras.map(c => (
            <div key={c.id} className="bg-[#21262d] rounded-lg p-4 flex items-center gap-3">
              <span className="text-2xl">📷</span>
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-[#8b949e]">
                  {c.location} · {c.online ? '🟢 Online' : '🔴 Offline'}
                  {c.last_seen && ` · Last seen ${new Date(c.last_seen * 1000).toLocaleTimeString()}`}
                </div>
              </div>
              <button onClick={() => remove(c.id)} className="text-[#f85149] text-sm">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
