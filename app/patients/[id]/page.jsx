'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PatientForm from '@/components/PatientForm';

import Icon from '@/components/Icon';
const RISK_COLOUR = { Low: '#22c55e', Medium: '#f97316', High: '#ef4444' };

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

  if (!patient) return <div className="p-4 text-[#666]">Loading...</div>;

  const riskLabel = (perf?.fallRisk || 0) < 33 ? 'Low' : (perf?.fallRisk || 0) < 66 ? 'Medium' : 'High';

  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center shrink-0">
          <Icon name="user" size={28} className="text-blue-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{patient.name}</h1>
          <div className="text-sm text-[#666]">Age {patient.age}</div>
        </div>
        <span className="text-sm font-bold px-3 py-1 rounded-full"
          style={{ background: `${RISK_COLOUR[riskLabel]}20`, color: RISK_COLOUR[riskLabel] }}>
          {riskLabel} Risk
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link href={`/patients/${id}/performance`}
          className="bg-[#111] border border-[#222] rounded-xl p-4 flex flex-col items-center gap-2 hover:border-blue-700 transition-colors">
          <Icon name="chart" size={22} className="text-blue-400" />
          <div className="text-sm font-bold text-blue-400">Performance</div>
        </Link>
        <Link href={`/patients/${id}/timeline`}
          className="bg-[#111] border border-[#222] rounded-xl p-4 flex flex-col items-center gap-2 hover:border-[#444] transition-colors">
          <Icon name="clock" size={22} className="text-[#888]" />
          <div className="text-sm font-bold text-[#888]">Timeline</div>
        </Link>
      </div>

      {!editing ? (
        <>
          <Section title="Conditions">
            <div className="flex flex-wrap gap-2">
              {patient.conditions?.map(c => (
                <span key={c} className="text-sm bg-[#1a1a1a] border border-[#333] px-3 py-1 rounded-full text-white">{c}</span>
              ))}
            </div>
          </Section>
          <Section title="Medications">
            {patient.medications?.map(m => (
              <div key={m} className="flex items-center gap-2 text-base text-white py-2 border-b border-[#1a1a1a] last:border-0">
                <Icon name="shield" size={14} className="text-[#555] shrink-0" />
                {m}
              </div>
            ))}
          </Section>
          <Section title="Daily Routine">
            {Object.entries(patient.routine || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-base py-2 border-b border-[#1a1a1a] last:border-0">
                <span className="text-[#666] capitalize">{k}</span>
                <span className="text-white">{v}</span>
              </div>
            ))}
          </Section>
          <button onClick={() => setEditing(true)}
            className="w-full border border-[#333] text-[#888] py-3.5 rounded-xl mt-4 flex items-center justify-center gap-2 text-base hover:border-[#555] hover:text-white transition-colors">
            <Icon name="edit" size={16} />
            Edit Profile
          </button>
        </>
      ) : (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4">
          <PatientForm initial={patient} onSave={save} onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-[#555] uppercase tracking-widest font-bold mb-2">{title}</div>
      <div className="bg-[#111] border border-[#222] rounded-xl p-4">{children}</div>
    </div>
  );
}
