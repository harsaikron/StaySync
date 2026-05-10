'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import Link from 'next/link';
import PatientForm from '@/components/PatientForm';
import Icon from '@/components/Icon';

function loadLocalPatients() {
  try { return JSON.parse(localStorage.getItem('staysync-local-patients') || '[]'); } catch { return []; }
}
function saveLocalPatient(p) {
  try {
    const existing = loadLocalPatients();
    const updated = [...existing.filter(x => x.id !== p.id), p];
    localStorage.setItem('staysync-local-patients', JSON.stringify(updated));
  } catch {}
}

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    const local = loadLocalPatients();
    get('/patients')
      .then(remote => {
        const remoteIds = new Set(remote.map(p => p.id));
        setPatients([...remote, ...local.filter(p => !remoteIds.has(p.id))]);
      })
      .catch(() => setPatients(local));
  };

  useEffect(() => { load(); }, []);

  const save = async (data) => {
    setSaving(true);
    // Generate a local id if none
    const patient = { ...data, id: data.id || `patient-${Date.now()}` };
    // Always save locally first so it appears immediately
    saveLocalPatient(patient);
    setAdding(false);
    load();
    // Try backend (non-fatal)
    try { await post('/patients', patient); load(); } catch {}
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon name="users" size={22} className="text-white" />
          <h1 className="text-2xl font-bold text-white">Patients</h1>
        </div>
        <button onClick={() => setAdding(v => !v)}
          className="text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
          style={{
            background: adding ? 'var(--surface,#1a1a1a)' : 'var(--blue,#2563eb)',
            border: adding ? '1px solid var(--border,#333)' : 'none',
            color: '#ffffff',
          }}>
          <Icon name={adding ? 'x' : 'plus'} size={16} color="#ffffff" />
          {adding ? 'Cancel' : 'Add Patient'}
        </button>
      </div>

      {adding && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 mb-4">
          <PatientForm onSave={save} onCancel={() => setAdding(false)} saving={saving} />
        </div>
      )}

      <div className="space-y-3">
        {patients.map(p => (
          <Link key={p.id} href={`/patients/${p.id}`}
            className="block bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#444] transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center shrink-0">
                <Icon name="user" size={22} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-white">{p.name}</div>
                <div className="text-sm text-[#666] mt-0.5">
                  Age {p.age} · {p.conditions?.[0] || 'No conditions listed'}
                </div>
              </div>
              <Icon name="chevron-right" size={18} className="text-[#444]" />
            </div>
          </Link>
        ))}
        {patients.length === 0 && !adding && (
          <div className="text-center py-20 flex flex-col items-center gap-4 text-[#555]">
            <Icon name="users" size={48} />
            <p className="text-base">No patients yet. Add one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
