'use client';
import { useEffect, useState } from 'react';
import { get, del } from '@/lib/api';
import Link from 'next/link';
import Icon from '@/components/Icon';

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
    <div className="min-h-screen bg-black p-4 pb-24">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon name="camera" size={22} className="text-white" />
          <h1 className="text-2xl font-bold text-white">Cameras</h1>
        </div>
        <Link href="/cameras/setup"
          className="bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Icon name="plus" size={16} />
          Add Camera
        </Link>
      </div>

      {cameras.length === 0 ? (
        <div className="text-center py-20 flex flex-col items-center gap-4 text-[#555]">
          <Icon name="camera" size={48} />
          <p className="text-base">No cameras yet</p>
          <Link href="/cameras/setup" className="text-blue-400 text-base flex items-center gap-1">
            Add your first camera <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cameras.map(c => (
            <div key={c.id} className="bg-[#111] border border-[#222] rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#222] flex items-center justify-center shrink-0">
                <Icon name="camera" size={20} className="text-[#666]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-white">{c.name}</div>
                <div className="text-sm text-[#666] flex items-center gap-2 mt-0.5">
                  <span>{c.location}</span>
                  <span>·</span>
                  <span className={`flex items-center gap-1 ${c.online ? 'text-green-400' : 'text-[#555]'}`}>
                    <Icon name={c.online ? 'signal' : 'x'} size={12} />
                    {c.online ? 'Online' : 'Offline'}
                  </span>
                  {c.last_seen && <span>· {new Date(c.last_seen * 1000).toLocaleTimeString()}</span>}
                </div>
              </div>
              <button onClick={() => remove(c.id)}
                className="text-red-500 p-2 rounded-lg border border-[#222] hover:border-red-900">
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
