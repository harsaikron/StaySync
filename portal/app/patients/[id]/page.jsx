'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PatientForm from '@/components/PatientForm';

const RISK_COLOUR = { Low: '#3fb950', Medium: '#f78536', High: '#f85149' };

export default function PatientDetailPage() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [perf, setPerf] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => {
    get(`/patients/${id}`).then(setPatient).catch(() => {});
    get(`/patients/${id}/performance`).then(setPerf).catch(() => {});
  };
  useEffect(() => { load(); }, [id]);

  const save = async (data) => {
    await post(`/patients/${id}`, data);
    setEditing(false);
    load();
  };

  if (!patient) return <div className="p-4 text-[#8b949e]">Loading...</div>;

  const riskLabel = (perf?.fallRisk || 0) < 33 ? 'Low' : (perf?.fallRisk || 0) < 66 ? 'Medium' : 'High';

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7]
          flex items-center justify-center text-3xl">👤</div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{patient.name}</h1>
          <div className="text-sm text-[#8b949e]">Age {patient.age}</div>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded"
          style={{ background: `${RISK_COLOUR[riskLabel]}22`, color: RISK_COLOUR[riskLabel] }}>
          {riskLabel} Risk
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link href={`/patients/${id}/performance`}
          className="bg-[#1a1a2e] border border-[#6e40c9] rounded-lg p-3 text-center">
          <div className="text-lg mb-1">📊</div>
          <div className="text-xs text-[#a371f7] font-bold">Performance</div>
        </Link>
        <Link href={`/patients/${id}/timeline`}
          className="bg-[#21262d] border border-[#30363d] rounded-lg p-3 text-center">
          <div className="text-lg mb-1">🕐</div>
          <div className="text-xs text-[#8b949e] font-bold">Timeline</div>
        </Link>
      </div>

      {!editing ? (
        <>
          <Section title="Conditions">
            {patient.conditions?.map(c => (
              <span key={c} className="text-xs bg-[#21262d] px-2 py-1 rounded mr-2 mb-2 inline-block">{c}</span>
            ))}
          </Section>
          <Section title="Medications">
            {patient.medications?.map(m => (
              <div key={m} className="text-sm text-[#e6edf3] py-1 border-b border-[#21262d] last:border-0">{m}</div>
            ))}
          </Section>
          <Section title="Daily Routine">
            {Object.entries(patient.routine || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-1 border-b border-[#21262d] last:border-0">
                <span className="text-[#8b949e] capitalize">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </Section>
          <button onClick={() => setEditing(true)}
            className="w-full border border-[#30363d] text-[#8b949e] py-3 rounded-lg mt-4">
            ✏️ Edit Profile
          </button>
        </>
      ) : (
        <div className="bg-[#21262d] rounded-lg p-4">
          <PatientForm initial={patient} onSave={save} onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-[#8b949e] uppercase tracking-wide font-bold mb-2">{title}</div>
      <div className="bg-[#21262d] rounded-lg p-3">{children}</div>
    </div>
  );
}
