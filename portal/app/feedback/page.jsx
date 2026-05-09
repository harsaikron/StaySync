'use client';
import { useState, useEffect } from 'react';
import { post, get } from '@/lib/api';

const CATEGORIES = [
  { value: 'detection', label: '🔍 AI Detection' },
  { value: 'alerts', label: '🚨 Alerts' },
  { value: 'camera', label: '📷 Camera' },
  { value: 'navigation', label: '🧭 Navigation' },
  { value: 'patients', label: '👤 Patient Info' },
  { value: 'performance', label: '⚡ Performance' },
  { value: 'other', label: '💬 Other' },
];

const PRIORITY_COLOR = { high: '#f85149', medium: '#f0883e', low: '#3fb950' };
const STATUS_COLOR = { proposed: '#58a6ff', in_review: '#f0883e', implemented: '#3fb950', rejected: '#8b949e' };

function ImprovementCard({ imp, onStatusChange }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded mr-2"
            style={{ background: PRIORITY_COLOR[imp.priority] + '22', color: PRIORITY_COLOR[imp.priority] }}>
            {imp.priority.toUpperCase()}
          </span>
          <span className="text-[10px] text-[#8b949e] uppercase">{imp.area}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full border"
          style={{ borderColor: STATUS_COLOR[imp.status], color: STATUS_COLOR[imp.status] }}>
          {imp.status.replace('_', ' ')}
        </span>
      </div>

      <div className="font-medium text-sm text-[#e6edf3]">{imp.title}</div>
      <div className="text-xs text-[#8b949e] leading-relaxed">{imp.description}</div>

      {imp.code_suggestion && (
        <pre className="text-xs bg-[#0d1117] border border-[#30363d] rounded p-2 text-[#79c0ff] overflow-x-auto whitespace-pre-wrap">
          {imp.code_suggestion}
        </pre>
      )}

      <div className="flex gap-2 pt-1">
        {['in_review', 'implemented', 'rejected'].map(s => (
          imp.status !== s && (
            <button key={s} onClick={() => onStatusChange(imp.id, s)}
              className="text-[10px] px-2 py-1 rounded border border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff]">
              → {s.replace('_', ' ')}
            </button>
          )
        ))}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const [tab, setTab] = useState('submit');
  const [form, setForm] = useState({ category: 'detection', message: '', user_type: 'caregiver' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);
  const [improvements, setImprovements] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const loadData = async () => {
    try {
      const [fb, imp] = await Promise.all([get('/feedback'), get('/feedback/improvements')]);
      setFeedbackList(fb);
      setImprovements(imp);
    } catch {}
  };

  useEffect(() => { loadData(); }, []);

  const submitFeedback = async () => {
    if (!form.message.trim()) return;
    setSubmitting(true);
    try {
      await post('/feedback', form);
      setSubmitted(true);
      setForm(f => ({ ...f, message: '' }));
      setTimeout(() => setSubmitted(false), 3000);
      loadData();
    } catch {}
    setSubmitting(false);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await post('/feedback/analyze', {});
      setAnalysisResult(result);
      loadData();
    } catch (err) {
      setAnalysisResult({ error: err.message });
    }
    setAnalyzing(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/feedback/improvements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      loadData();
    } catch {}
  };

  const pendingCount = feedbackList.filter(f => f.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 pb-24">
      <h1 className="text-xl font-bold mb-1">🤖 AI Feedback Loop</h1>
      <p className="text-[#8b949e] text-xs mb-4">Your feedback teaches Gemma 4 to improve StaySync automatically.</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'submit', label: '✍️ Submit' },
          { id: 'tickets', label: `📋 Tickets ${feedbackList.length > 0 ? `(${feedbackList.length})` : ''}` },
          { id: 'improvements', label: `💡 AI Ideas ${improvements.length > 0 ? `(${improvements.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-1 rounded-lg text-xs text-center transition-colors ${tab === t.id
              ? 'bg-[#1f6feb] text-white' : 'bg-[#21262d] text-[#8b949e]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Submit Tab */}
      {tab === 'submit' && (
        <div className="space-y-4">
          <div className="bg-[#161b22] border border-[#1f6feb33] rounded-lg p-3 text-xs text-[#8b949e]">
            Describe what's working, what's broken, or what could be better. Gemma 4 reads every ticket and writes improvement code automatically.
          </div>

          <div>
            <label className="text-xs text-[#8b949e] block mb-1">I am a</label>
            <div className="flex gap-2">
              {['caregiver', 'patient', 'developer'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, user_type: t }))}
                  className={`flex-1 py-2 rounded-lg text-xs border ${form.user_type === t
                    ? 'border-[#1f6feb] text-white bg-[#1f6feb22]' : 'border-[#30363d] text-[#8b949e]'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#8b949e] block mb-1">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  className={`py-2 px-3 rounded-lg text-xs text-left border ${form.category === c.value
                    ? 'border-[#1f6feb] text-white bg-[#1f6feb22]' : 'border-[#30363d] text-[#8b949e]'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#8b949e] block mb-1">Your feedback</label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Describe what you experienced, what you expected, or an idea for improvement..."
              rows={4}
              className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#1f6feb] resize-none"
            />
          </div>

          {submitted && (
            <div className="bg-[#1a3a2a] text-[#3fb950] text-sm rounded-lg px-4 py-3">
              ✓ Feedback received — Gemma 4 will review it shortly.
            </div>
          )}

          <button onClick={submitFeedback} disabled={submitting || !form.message.trim()}
            className="w-full bg-[#238636] text-white py-3 rounded-lg font-medium disabled:opacity-50">
            {submitting ? 'Sending...' : '📤 Submit Feedback'}
          </button>
        </div>
      )}

      {/* Tickets Tab */}
      {tab === 'tickets' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8b949e]">{pendingCount} pending analysis</span>
            <button onClick={runAnalysis} disabled={analyzing || pendingCount === 0}
              className="text-xs px-3 py-1.5 bg-[#1f6feb] text-white rounded-lg disabled:opacity-50 flex items-center gap-1">
              {analyzing ? '⏳ Gemma thinking...' : '🤖 Run AI Analysis'}
            </button>
          </div>

          {analyzing && (
            <div className="bg-[#161b22] border border-[#1f6feb33] rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">🧠</div>
              <div className="text-sm text-[#58a6ff]">Gemma 4 is reading your feedback...</div>
              <div className="text-xs text-[#8b949e] mt-1">Generating improvement proposals</div>
            </div>
          )}

          {analysisResult && !analysisResult.error && (
            <div className="bg-[#1a2a1a] border border-[#238636] rounded-lg p-3 space-y-1">
              <div className="text-xs font-bold text-[#3fb950]">✓ Analysis complete — {analysisResult.analyzed_count} tickets processed</div>
              {analysisResult.top_insight && <div className="text-xs text-[#e6edf3]">💡 {analysisResult.top_insight}</div>}
              {analysisResult.summary && <div className="text-xs text-[#8b949e]">{analysisResult.summary}</div>}
              <button onClick={() => setTab('improvements')} className="text-xs text-[#58a6ff] mt-1">
                → View {analysisResult.improvements?.length} new proposals
              </button>
            </div>
          )}

          {feedbackList.length === 0 ? (
            <div className="text-[#8b949e] text-center py-8 text-sm">No feedback yet — submit some!</div>
          ) : (
            feedbackList.map(f => (
              <div key={f.id} className="bg-[#21262d] rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#8b949e]">{CATEGORIES.find(c => c.value === f.category)?.label || f.category}</span>
                    <span className="text-[10px] text-[#8b949e]">· {f.user_type}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${f.status === 'pending' ? 'bg-[#1f6feb22] text-[#58a6ff]' : 'bg-[#23863622] text-[#3fb950]'}`}>
                    {f.status}
                  </span>
                </div>
                <div className="text-sm text-[#e6edf3]">{f.message}</div>
                <div className="text-[10px] text-[#8b949e]">{new Date(f.created_at * 1000).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Improvements Tab */}
      {tab === 'improvements' && (
        <div className="space-y-3">
          {improvements.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="text-4xl">🤖</div>
              <div className="text-sm text-[#8b949e]">No AI proposals yet</div>
              <div className="text-xs text-[#8b949e]">Submit feedback and run analysis to generate improvement ideas</div>
            </div>
          ) : (
            improvements.map(imp => (
              <ImprovementCard key={imp.id} imp={imp} onStatusChange={updateStatus} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
