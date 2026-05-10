'use client';
import { useEffect, useState } from 'react';
import { get, del } from '@/lib/api';
import Link from 'next/link';
import Icon from '@/components/Icon';

function loadLocalCameras() {
  try {
    return JSON.parse(localStorage.getItem('staysync-local-cameras') || '[]');
  } catch {
    return [];
  }
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState([]);

  const load = () => {
    const local = loadLocalCameras();
    get('/cameras')
      .then(remote => {
        // Merge: remote takes precedence over local for same ID
        const remoteIds = new Set(remote.map(c => c.id));
        const merged = [...remote, ...local.filter(c => !remoteIds.has(c.id))];
        setCameras(merged);
      })
      .catch(() => {
        // Backend unreachable — show local cameras only
        setCameras(local);
      });
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm('Remove this camera?')) return;
    // Remove from localStorage
    try {
      const local = JSON.parse(localStorage.getItem('staysync-local-cameras') || '[]');
      localStorage.setItem('staysync-local-cameras', JSON.stringify(local.filter(c => c.id !== id)));
    } catch {}
    // Try backend too (non-fatal)
    del(`/cameras/${id}`).catch(() => {});
    load();
  };

  return (
    <div className="min-h-screen p-4 pb-24" style={{ background: 'var(--bg,#000)' }}>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text,#fff)' }}>Cameras</h1>
        <Link href="/cameras/setup"
          className="text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2"
          style={{ background: 'var(--blue,#2563eb)', color: '#ffffff' }}>
          <Icon name="plus" size={16} color="#ffffff" />
          Add
        </Link>
      </div>

      {cameras.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20" style={{ color: 'var(--text-muted,#555)' }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)' }}>
            <Icon name="camera" size={36} color="var(--text-muted,#555)" />
          </div>
          <p className="text-base" style={{ color: 'var(--text-muted,#555)' }}>No cameras added yet</p>
          <Link href="/cameras/setup"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
            style={{ background: 'var(--blue,#2563eb)', color: '#ffffff' }}>
            <Icon name="plus" size={14} color="#ffffff" />
            Add your first camera
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cameras.map(c => (
            <div key={c.id} className="rounded-2xl flex items-center gap-0 overflow-hidden"
              style={{ background: 'var(--surface,#111)', border: '1px solid var(--border,#222)' }}>
              <a href={`/cameras/view?id=${encodeURIComponent(c.id)}`}
                className="flex items-center gap-4 flex-1 p-4 min-w-0">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--surface-deep,#0a0a0a)', border: '1px solid var(--border,#222)' }}>
                  <Icon name="camera" size={22} color={c.status === 'online' ? '#22c55e' : 'var(--text-muted,#555)'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold" style={{ color: 'var(--text,#fff)' }}>{c.name || c.id}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'online' ? 'bg-green-400' : 'bg-[#444]'}`} />
                    <span className="text-sm" style={{ color: 'var(--text-muted,#888)' }}>
                      {c.status === 'online' ? 'Online' : 'Offline'}
                      {c.location ? ` · ${c.location}` : ''}
                    </span>
                  </div>
                </div>
                <Icon name="chevron-right" size={16} color="var(--text-muted,#555)" />
              </a>
              <button onClick={() => remove(c.id)}
                className="p-4 shrink-0"
                style={{ borderLeft: '1px solid var(--border,#222)', color: '#ef4444' }}>
                <Icon name="trash" size={16} color="#ef4444" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
