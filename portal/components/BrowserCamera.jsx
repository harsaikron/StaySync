'use client';
import { useEffect, useRef, useState } from 'react';
import { post } from '@/lib/api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BrowserCamera({ cameraId, cameraName, onRegistered }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | streaming | error
  const [facingMode, setFacingMode] = useState('environment'); // environment=back, user=front
  const [uploadCount, setUploadCount] = useState(0);
  const [log, setLog] = useState('');

  const startCamera = async (mode) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Register camera with backend
      await post('/cameras/register', {
        id: cameraId,
        name: cameraName,
        location: 'browser'
      });
      onRegistered && onRegistered(cameraId);

      setStatus('streaming');
      setLog('Camera started — uploading frames...');
      startUploadLoop();
    } catch (err) {
      setStatus('error');
      setLog(`Error: ${err.message}`);
    }
  };

  const startUploadLoop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(uploadFrame, 3000);
  };

  const uploadFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const res = await fetch(`${BASE}/upload/${cameraId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob
        });
        if (res.ok) setUploadCount(n => n + 1);
      } catch {}
    }, 'image/jpeg', 0.85);
  };

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setStatus('idle');
    setLog('');
    setUploadCount(0);
  };

  const switchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  useEffect(() => () => { stopCamera(); }, []);

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-[#161b22] rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        {status === 'streaming' ? (
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">📷</span>
        )}
      </div>

      {status === 'idle' || status === 'error' ? (
        <button onClick={() => startCamera(facingMode)}
          className="w-full bg-[#238636] text-white py-3 rounded-lg font-medium">
          📷 Start Camera
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={stopCamera}
            className="flex-1 border border-[#f85149] text-[#f85149] py-2 rounded-lg text-sm">
            ■ Stop
          </button>
          <button onClick={switchCamera}
            className="flex-1 border border-[#30363d] text-[#8b949e] py-2 rounded-lg text-sm">
            🔄 Flip Camera
          </button>
        </div>
      )}

      {log && (
        <div className={`text-xs px-3 py-2 rounded ${status === 'error'
          ? 'text-[#f85149] bg-[#3a1a1a]' : 'text-[#3fb950] bg-[#1a3a2a]'}`}>
          {status === 'streaming' ? `✓ Live — ${uploadCount} frames sent` : log}
        </div>
      )}
    </div>
  );
}
