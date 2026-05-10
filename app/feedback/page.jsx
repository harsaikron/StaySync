'use client';
import { useState, useEffect, useRef } from 'react';
import { post, get } from '@/lib/api';
import Icon from '@/components/Icon';

const CATEGORIES = [
  { value: 'detection', label: 'AI Detection',  icon: 'search' },
  { value: 'alerts',    label: 'Alerts',         icon: 'bell' },
  { value: 'camera',    label: 'Camera',         icon: 'camera' },
  { value: 'navigation',label: 'Navigation',     icon: 'activity' },
  { value: 'patients',  label: 'Patient Info',   icon: 'user' },
  { value: 'performance',label: 'Performance',   icon: 'chart' },
  { value: 'other',     label: 'Other',          icon: 'message' },
];

const PRIORITY_COLOR = { high: '#ef4444', medium: '#f97316', low: '#22c55e' };
const STATUS_COLOR = { proposed: '#60a5fa', in_review: '#f97316', implemented: '#22c55e', rejected: '#666' };

function ImprovementCard({ imp, onStatusChange }) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: PRIORITY_COLOR[imp.priority] + '20', color: PRIORITY_COLOR[imp.priority] }}>
            {imp.priority.toUpperCase()}
          </span>
          <span className="text-xs text-[#555] uppercase tracking-wide">{imp.area}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full border"
          style={{ borderColor: STATUS_COLOR[imp.status], color: STATUS_COLOR[imp.status] }}>
          {imp.status.replace('_', ' ')}
        </span>
      </div>

      <div className="text-base font-semibold text-white">{imp.title}</div>
      <div className="text-sm text-[#888] leading-relaxed">{imp.description}</div>

      {imp.code_suggestion && (
        <pre className="text-sm bg-black border border-[#222] rounded-xl p-3 text-blue-300 overflow-x-auto whitespace-pre-wrap font-mono">
          {imp.code_suggestion}
        </pre>
      )}

      <div className="flex gap-2 pt-1">
        {['in_review', 'implemented', 'rejected'].map(s => (
          imp.status !== s && (
            <button key={s} onClick={() => onStatusChange(imp.id, s)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#333] text-[#888] hover:border-blue-700 hover:text-blue-400 flex items-center gap-1">
              <Icon name="chevron-right" size={12} />
              {s.replace('_', ' ')}
            </button>
          )
        ))}
      </div>
    </div>
  );
}

const AUTO_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function FeedbackPage() {
  const [tab, setTab] = useState('submit');
  const [form, setForm] = useState({ category: 'detection', message: '', user_type: 'caregiver' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);
  const [improvements, setImprovements] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [autoEvolve, setAutoEvolve] = useState(false);
  const [nextRunIn, setNextRunIn] = useState(null);
  const autoTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const loadData = async () => {
    try {
      const [fb, imp] = await Promise.all([get('/feedback'), get('/feedback/improvements')]);
      setFeedbackList(fb);
      setImprovements(imp);
    } catch {}
  };

  useEffect(() => { loadData(); }, []);

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

  const stopAutoEvolve = () => {
    setAutoEvolve(false);
    setNextRunIn(null);
    clearInterval(autoTimerRef.current);
    clearInterval(countdownRef.current);
  };

  useEffect(() => {
    if (!autoEvolve) return;

    runAnalysis();

    let remaining = AUTO_INTERVAL_MS / 1000;
    setNextRunIn(remaining);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setNextRunIn(remaining);
    }, 1000);

    autoTimerRef.current = setInterval(() => {
      runAnalysis();
      remaining = AUTO_INTERVAL_MS / 1000;
      setNextRunIn(remaining);
    }, AUTO_INTERVAL_MS);

    return () => {
      clearInterval(autoTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [autoEvolve]);

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
    <div className="min-h-screen bg-black p-4 pb-24">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Icon name="bot" size={22} className="text-white" />
          <h1 className="text-2xl font-bold text-white">AI Feedback</h1>
        </div>
        {autoEvolve ? (
          <button onClick={stopAutoEvolve}
            className="text-sm px-3 py-1.5 rounded-xl border border-red-800 text-red-400 flex items-center gap-1.5">
            <Icon name="stop" size={14} /> Stop
          </button>
        ) : (
          <button onClick={() => setAutoEvolve(true)}
            className="text-sm px-3 py-1.5 rounded-xl border border-green-800 text-green-400 flex items-center gap-1.5">
            <Icon name="play" size={14} /> Auto-Evolve
          </button>
        )}
      </div>

      {autoEvolve && (
        <div className="flex items-center gap-2 mb-4 bg-green-950 border border-green-800 rounded-xl px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-sm text-green-400">Auto-evolving — Gemma 4 runs every 5 min</span>
          {nextRunIn !== null && !analyzing && (
            <span className="text-xs text-[#888] ml-auto">
              next in {Math.floor(nextRunIn / 60)}:{String(nextRunIn % 60).padStart(2, '0')}
            </span>
          )}
          {analyzing && <span className="text-xs text-blue-400 ml-auto">analysing now...</span>}
        </div>
      )}
      {!autoEvolve && <p className="text-sm text-[#666] mb-4">Your feedback teaches Gemma 4 to improve StaySync automatically.</p>}

      <div className="flex gap-2 mb-5">
        {[
          { id: 'submit',       icon: 'edit',      label: 'Submit' },
          { id: 'tickets',      icon: 'clipboard', label: `Tickets${feedbackList.length ? ` (${feedbackList.length})` : ''}` },
          { id: 'improvements', icon: 'lightbulb', label: `Ideas${improvements.length ? ` (${improvements.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 px-1 rounded-xl text-center transition-colors flex flex-col items-center gap-1
              ${tab === t.id ? 'bg-blue-600' : 'bg-[#111] border border-[#222]'}`}
            style={{ color: tab === t.id ? '#ffffff' : '#666' }}>
            <Icon name={t.icon} size={16} color={tab === t.id ? '#ffffff' : '#666'} />
            <span className="text-xs font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'submit' && (
        <div className="space-y-4">
          <div className="bg-[#111] border border-blue-900 rounded-xl p-4 text-sm text-[#888]">
            Describe what's working, what's broken, or what could be better. Gemma 4 reads every ticket and writes improvement code automatically.
          </div>

          <div>
            <label className="text-sm text-[#888] block mb-2">I am a</label>
            <div className="flex gap-2">
              {['caregiver', 'patient', 'developer'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, user_type: t }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm border font-medium transition-colors ${form.user_type === t
                    ? 'bg-blue-600 border-blue-600' : 'border-[#333]'}`}
                  style={{ color: form.user_type === t ? '#ffffff' : '#666' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-[#888] block mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  className={`py-2.5 px-3 rounded-xl text-sm text-left border flex items-center gap-2 transition-colors ${form.category === c.value
                    ? 'bg-blue-600 border-blue-600' : 'border-[#333]'}`}
                  style={{ color: form.category === c.value ? '#ffffff' : '#666' }}>
                  <Icon name={c.icon} size={14} color={form.category === c.value ? '#ffffff' : '#666'} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-[#888] block mb-2">Your feedback</label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Describe what you experienced, what you expected, or an idea for improvement..."
              rows={4}
              className="w-full bg-black border border-[#333] rounded-xl px-4 py-3 text-base text-white outline-none focus:border-blue-600 resize-none"
            />
          </div>

          {submitted && (
            <div className="bg-green-950 border border-green-800 text-green-400 text-base rounded-xl px-4 py-3 flex items-center gap-2">
              <Icon name="check" size={16} /> Feedback received — Gemma 4 will review it shortly.
            </div>
          )}

          <button onClick={submitFeedback} disabled={submitting || !form.message.trim()}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            <Icon name="send" size={18} />
            {submitting ? 'Sending...' : 'Submit Feedback'}
          </button>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#666]">{pendingCount} pending</span>
            <button onClick={runAnalysis} disabled={analyzing || pendingCount === 0}
              className="text-sm px-3 py-2 bg-blue-600 text-white rounded-xl disabled:opacity-40 flex items-center gap-2">
              <Icon name={analyzing ? 'refresh' : 'bot'} size={16} className={analyzing ? 'animate-spin' : ''} />
              {analyzing ? 'Thinking...' : 'Run Now'}
            </button>
          </div>

          {analyzing && (
            <div className="bg-[#111] border border-blue-900 rounded-xl p-6 text-center space-y-2">
              <Icon name="bot" size={36} className="text-blue-400 mx-auto" />
              <div className="text-base text-blue-400">Gemma 4 is reading your feedback...</div>
              <div className="text-sm text-[#666]">Generating improvement proposals</div>
            </div>
          )}

          {analysisResult && !analysisResult.error && (
            <div className="bg-green-950 border border-green-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
                <Icon name="check" size={16} />
                Analysis complete — {analysisResult.analyzed_count} tickets processed
              </div>
              {analysisResult.top_insight && (
                <div className="flex items-start gap-2 text-sm text-white">
                  <Icon name="lightbulb" size={14} className="text-orange-400 shrink-0 mt-0.5" />
                  {analysisResult.top_insight}
                </div>
              )}
              {analysisResult.summary && <div className="text-sm text-[#888]">{analysisResult.summary}</div>}
              <button onClick={() => setTab('improvements')}
                className="text-sm text-blue-400 flex items-center gap-1">
                View {analysisResult.improvements?.length} new proposals
                <Icon name="arrow-right" size={14} />
              </button>
            </div>
          )}

          {feedbackList.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-3 text-[#555]">
              <Icon name="clipboard" size={40} />
              <span className="text-base">No feedback yet — submit some!</span>
            </div>
          ) : (
            feedbackList.map(f => (
              <div key={f.id} className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name={CATEGORIES.find(c => c.value === f.category)?.icon || 'message'} size={13} className="text-[#666]" />
                    <span className="text-sm text-[#888]">{CATEGORIES.find(c => c.value === f.category)?.label || f.category}</span>
                    <span className="text-xs text-[#555]">· {f.user_type}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                    ${f.status === 'pending' ? 'bg-blue-950 text-blue-400' : 'bg-green-950 text-green-400'}`}>
                    {f.status}
                  </span>
                </div>
                <div className="text-base text-white">{f.message}</div>
                <div className="text-xs text-[#555]">{new Date(f.created_at * 1000).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'improvements' && (
        <div className="space-y-3">
          {improvements.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4 text-[#555]">
              <Icon name="lightbulb" size={48} />
              <div className="text-base">No AI proposals yet</div>
              <div className="text-sm">Submit feedback and run analysis to generate ideas</div>
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
