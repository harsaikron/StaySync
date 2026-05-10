'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

function getBackendUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return (
    localStorage.getItem('staysync-backend-url') ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  ).replace(/\/$/, '');
}

function getCaptureInterval() {
  if (typeof window === 'undefined') return 5000;
  const v = parseInt(localStorage.getItem('camera-capture-interval') || '5', 10);
  return Math.max(3, v) * 1000;
}

// Save camera to localStorage so the cameras list works even without backend
function saveLocalCamera(cam) {
  try {
    const existing = JSON.parse(localStorage.getItem('staysync-local-cameras') || '[]');
    const updated = [...existing.filter(c => c.id !== cam.id), cam];
    localStorage.setItem('staysync-local-cameras', JSON.stringify(updated));
  } catch {}
}

export default function BrowserCamera({ cameraId, cameraName, onRegistered, compact = false }) {
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const streamRef     = useRef(null);
  const timerRef      = useRef(null);

  const [status,      setStatus]      = useState('idle');    // idle | starting | streaming | registered
  const [facingMode,  setFacingMode]  = useState('environment');
  const [frameCount,  setFrameCount]  = useState(0);
  const [lastFrame,   setLastFrame]   = useState(null);
  const [guidance,    setGuidance]    = useState('');
  const [analyzing,   setAnalyzing]   = useState(false);
  const [addingCam,   setAddingCam]   = useState(false);
  const [addError,    setAddError]    = useState('');

  // Re-attach stream if video element ever loses srcObject
  useEffect(() => {
    if (status === 'streaming' && videoRef.current && streamRef.current) {
      if (!videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [status]);

  useEffect(() => () => stopCamera(), []);

  const startCamera = async (mode) => {
    setStatus('starting');
    setAddError('');
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      setStatus('streaming');

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });

      // Start capturing frames for AI analysis (upload-only, no registration yet)
      startUploadLoop();
    } catch (err) {
      setStatus('idle');
      setAddError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied — allow camera access in browser settings'
          : `Could not start camera: ${err.message}`
      );
    }
  };

  const registerCamera = async () => {
    setAddingCam(true);
    setAddError('');
    const base = getBackendUrl();
    const cam = { id: cameraId, name: cameraName, location: 'browser', type: 'browser', status: 'online' };

    // Always save locally so the camera appears in the list
    saveLocalCamera(cam);

    // Try backend registration (non-fatal)
    try {
      await fetch(`${base}/cameras/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cam),
      });
    } catch {
      // Backend unreachable — camera is saved locally, still works
    }

    setStatus('registered');
    setAddingCam(false);
    onRegistered?.(cameraId);
  };

  const startUploadLoop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(captureAndAnalyze, getCaptureInterval());
  };

  const captureAndAnalyze = async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setLastFrame(canvas.toDataURL('image/jpeg', 0.7));

    // Skip if paused from dashboard
    try { if (localStorage.getItem(`staysync-cam-paused-${cameraId}`) === 'true') return; } catch {}

    const frameDataUrl = canvas.toDataURL('image/jpeg', 0.45);

    // Persist latest frame for dashboard preview
    try { localStorage.setItem(`staysync-cam-frame-${cameraId}`, frameDataUrl); } catch {}

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const base = getBackendUrl();
      try {
        setAnalyzing(true);
        const res = await fetch(`${base}/upload/${cameraId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.guidance) {
            setGuidance(data.guidance);
            try { localStorage.setItem(`staysync-cam-guidance-${cameraId}`, data.guidance); } catch {}
            // Append to 24h activity log (text only, no photos)
            try {
              const log = JSON.parse(localStorage.getItem('staysync-activity-log') || '[]');
              const cutoff = Date.now() - 864e5;
              const entry = { id: String(Date.now()), ts: Date.now(), camId: cameraId, guidance: data.guidance };
              localStorage.setItem('staysync-activity-log', JSON.stringify(
                [entry, ...log.filter(e => e.ts > cutoff)].slice(0, 500)
              ));
            } catch {}
          }
          // Store last 10 frames with guidance for dashboard gallery
          try {
            const frames = JSON.parse(localStorage.getItem(`staysync-cam-frames-${cameraId}`) || '[]');
            const entry = { ts: Date.now(), frame: frameDataUrl, guidance: data.guidance || '' };
            localStorage.setItem(`staysync-cam-frames-${cameraId}`, JSON.stringify([entry, ...frames].slice(0, 10)));
          } catch {}
          setFrameCount(n => n + 1);
        }
      } catch {
        // Backend not reachable — still show local preview
      } finally {
        setAnalyzing(false);
      }
    }, 'image/jpeg', 0.85);
  };

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setStatus('idle');
    setFrameCount(0);
    setLastFrame(null);
    setGuidance('');
    setAddError('');
  };

  const switchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const isStreaming = status === 'streaming' || status === 'registered';

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview */}
      <div
        className="rounded-xl overflow-hidden flex items-center justify-center relative"
        style={{
          background: '#000',
          border: '1px solid var(--border,#222)',
          aspectRatio: compact ? '4/3' : '16/9',
          maxHeight: compact ? '220px' : undefined,
        }}>
        <video
          ref={videoRef} autoPlay playsInline muted
          className="w-full h-full object-cover"
          style={{ display: isStreaming ? 'block' : 'none' }}
        />
        {!isStreaming && lastFrame && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lastFrame} alt="Last frame" className="w-full h-full object-cover opacity-40" />
        )}
        {!isStreaming && !lastFrame && (
          <Icon name="camera" size={compact ? 32 : 48} color="#333" />
        )}

        {/* Analysing overlay */}
        {analyzing && (
          <div className="absolute inset-0 flex items-end p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ background: 'rgba(30,58,138,0.9)' }}>
              <Icon name="bot" size={14} color="#93c5fd" />
              <span className="text-xs font-medium" style={{ color: '#93c5fd' }}>Gemma 4 analysing…</span>
            </div>
          </div>
        )}

        {/* Frame counter */}
        {frameCount > 0 && !analyzing && (
          <div className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#22c55e', border: '1px solid #16a34a' }}>
            {frameCount} analysed
          </div>
        )}
      </div>

      {/* Controls */}
      {!isStreaming ? (
        <button onClick={() => startCamera(facingMode)} disabled={status === 'starting'}
          className="w-full py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: '#2563eb', color: '#ffffff' }}>
          <Icon name="camera" size={18} color="#ffffff" />
          {status === 'starting' ? 'Starting…' : 'Start Camera'}
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={stopCamera}
            className="py-3 px-4 rounded-xl text-base flex items-center gap-2"
            style={{ border: '1px solid #7f1d1d', color: '#f87171' }}>
            <Icon name="stop" size={16} color="#f87171" /> Stop
          </button>
          <button onClick={switchCamera}
            className="py-3 px-4 rounded-xl text-base flex items-center gap-2"
            style={{ border: '1px solid var(--border,#333)', color: 'var(--text-muted,#888)' }}>
            <Icon name="refresh" size={16} color="var(--text-muted,#888)" /> Flip
          </button>
        </div>
      )}

      {/* ADD CAMERA button — shown once preview is live and not yet registered */}
      {status === 'streaming' && (
        <button onClick={registerCamera} disabled={addingCam}
          className="w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: '#16a34a', color: '#ffffff' }}>
          <Icon name="check" size={20} color="#ffffff" />
          {addingCam ? 'Adding Camera…' : 'Add This Camera'}
        </button>
      )}

      {/* Registered success */}
      {status === 'registered' && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2"
          style={{ background: '#052e16', border: '1px solid #166534' }}>
          <Icon name="check" size={16} color="#4ade80" />
          <span className="text-sm font-medium" style={{ color: '#4ade80' }}>
            Camera added! Still streaming and analysing.
          </span>
        </div>
      )}

      {/* Error */}
      {addError && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2"
          style={{ background: '#450a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
          <Icon name="warning" size={15} color="#fca5a5" />
          <span className="text-sm">{addError}</span>
        </div>
      )}

      {/* AI Analysis result */}
      {guidance && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: '#1e3a8a', border: '1px solid #1d4ed8' }}>
          <div className="flex items-center gap-2">
            <Icon name="bot" size={14} color="#93c5fd" />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#93c5fd' }}>
              Gemma 4 sees
            </span>
          </div>
          <p className="text-base leading-relaxed" style={{ color: '#ffffff' }}>{guidance}</p>
        </div>
      )}

      {/* Backend not configured hint */}
      {frameCount === 0 && isStreaming && !guidance && !analyzing && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2"
          style={{ background: '#1c1917', border: '1px solid #44403c', color: '#a8a29e' }}>
          <Icon name="info" size={14} color="#a8a29e" />
          <div className="text-sm">
            Camera preview is live. AI analysis needs the backend URL.{' '}
            <a href="/settings" style={{ color: '#60a5fa' }}>Set it in Settings →</a>
          </div>
        </div>
      )}
    </div>
  );
}
