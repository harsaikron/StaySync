'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import Link from 'next/link';
import PatientForm from '@/components/PatientForm';

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = () => get('/patients').then(setPatients).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (data) => {
    await post('/patients', data);
    setAdding(false);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">👤 Patients</h1>
        <button onClick={() => setAdding(v => !v)}
          className="bg-[#1f6feb] text-white text-sm px-4 py-2 rounded-lg">
          {adding ? 'Cancel' : '+ Add Patient'}
        </button>
      </div>

      {adding && (
        <div className="bg-[#21262d] rounded-lg p-4 mb-4">
          <PatientForm onSave={save} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="space-y-3">
        {patients.map(p => (
          <Link key={p.id} href={`/patients/${p.id}`}
            className="block bg-[#21262d] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7]
                flex items-center justify-center text-xl">👤</div>
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-[#8b949e]">Age {p.age} · {p.conditions?.[0] || 'No conditions listed'}</div>
              </div>
            </div>
          </Link>
        ))}
        {patients.length === 0 && !adding && (
          <div className="text-center py-16 text-[#8b949e]">
            <div className="text-4xl mb-3">👤</div>
            <p>No patients yet. Add one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
