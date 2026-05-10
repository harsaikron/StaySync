'use client';
import { useState } from 'react';

const ROUTINE_KEYS = ['wake', 'breakfast', 'medicine', 'lunch', 'dinner', 'sleep'];

export default function PatientForm({ initial = {}, onSave, onCancel, saving = false }) {
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

  const inputCls = "w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-600 border";
  const inputStyle = { background: 'var(--surface-deep,#0a0a0a)', borderColor: 'var(--border,#333)', color: 'var(--text,#fff)' };

  return (
    <div className="space-y-4">
      {[{ key: 'name', label: 'Full name', placeholder: 'John Doe' },
        { key: 'age', label: 'Age', placeholder: '74', type: 'number' }
      ].map(({ key, label, placeholder, type = 'text' }) => (
        <div key={key}>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted,#888)' }}>{label}</label>
          <input type={type} value={form[key]} placeholder={placeholder}
            onChange={e => set(key, e.target.value)}
            className={inputCls} style={inputStyle} />
        </div>
      ))}

      <div>
        <label className="text-xs block mb-1" style={{ color: 'var(--text-muted,#888)' }}>Conditions (comma-separated)</label>
        <input value={form.conditions} onChange={e => set('conditions', e.target.value)}
          placeholder="Alzheimer's, Hypertension"
          className={inputCls} style={inputStyle} />
      </div>

      <div>
        <label className="text-xs block mb-1" style={{ color: 'var(--text-muted,#888)' }}>Medications (comma-separated)</label>
        <input value={form.medications} onChange={e => set('medications', e.target.value)}
          placeholder="Donepezil 10mg, Lisinopril 5mg"
          className={inputCls} style={inputStyle} />
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted,#666)' }}>AI will announce reminders at scheduled medication time.</p>
      </div>

      <div>
        <label className="text-xs block mb-2" style={{ color: 'var(--text-muted,#888)' }}>Daily routine — AI announces each item when it's time</label>
        <div className="space-y-2">
          {ROUTINE_KEYS.map(key => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs w-20 capitalize" style={{ color: 'var(--text-muted,#888)' }}>{key}</span>
              <input type="time" value={form.routine[key] || ''}
                onChange={e => setRoutine(key, e.target.value)}
                className="flex-1 rounded px-2 py-1.5 text-sm outline-none border"
                style={inputStyle} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button onClick={onCancel} disabled={saving}
            className="py-3.5 px-5 rounded-xl font-semibold text-sm"
            style={{ background: '#1c1917', border: '1px solid #57534e', color: '#d6d3d1' }}>
            Cancel
          </button>
        )}
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-3.5 rounded-xl font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: '#2563eb', color: '#ffffff' }}>
          {saving ? 'Saving…' : 'Save Patient'}
        </button>
      </div>
    </div>
  );
}
