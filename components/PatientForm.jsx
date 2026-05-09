'use client';
import { useState } from 'react';

const ROUTINE_KEYS = ['wake', 'breakfast', 'medicine', 'lunch', 'dinner', 'sleep'];

export default function PatientForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    age: initial.age || '',
    conditions: (initial.conditions || []).join(', '),
    medications: (initial.medications || []).join(', '),
    routine: initial.routine || {},
    camera_ids: initial.camera_ids || []
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setRoutine = (key, val) => setForm(f => ({ ...f, routine: { ...f.routine, [key]: val } }));

  const handleSave = () => {
    onSave({
      ...form,
      age: Number(form.age),
      conditions: form.conditions.split(',').map(s => s.trim()).filter(Boolean),
      medications: form.medications.split(',').map(s => s.trim()).filter(Boolean)
    });
  };

  return (
    <div className="space-y-4">
      {[{ key: 'name', label: 'Full name', placeholder: 'John Doe' },
        { key: 'age', label: 'Age', placeholder: '74', type: 'number' }
      ].map(({ key, label, placeholder, type = 'text' }) => (
        <div key={key}>
          <label className="text-xs text-[#8b949e] block mb-1">{label}</label>
          <input type={type} value={form[key]} placeholder={placeholder}
            onChange={e => set(key, e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb]" />
        </div>
      ))}

      <div>
        <label className="text-xs text-[#8b949e] block mb-1">Conditions (comma-separated)</label>
        <input value={form.conditions} onChange={e => set('conditions', e.target.value)}
          placeholder="Alzheimer's, Hypertension"
          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb]" />
      </div>

      <div>
        <label className="text-xs text-[#8b949e] block mb-1">Medications (comma-separated)</label>
        <input value={form.medications} onChange={e => set('medications', e.target.value)}
          placeholder="Donepezil 10mg, Lisinopril 5mg"
          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb]" />
      </div>

      <div>
        <label className="text-xs text-[#8b949e] block mb-2">Daily routine</label>
        <div className="space-y-2">
          {ROUTINE_KEYS.map(key => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-[#8b949e] w-20 capitalize">{key}</span>
              <input type="time" value={form.routine[key] || ''}
                onChange={e => setRoutine(key, e.target.value)}
                className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-sm text-[#e6edf3] outline-none" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave}
          className="flex-1 bg-[#238636] text-white py-3 rounded-lg font-medium">
          Save Patient
        </button>
        {onCancel && (
          <button onClick={onCancel}
            className="flex-1 border border-[#30363d] text-[#8b949e] py-3 rounded-lg">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
