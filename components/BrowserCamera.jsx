'use client';
import { useEffect, useRef, useState } from 'react';
import { post } from '@/lib/api';
import Icon from '@/components/Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BrowserCamera({ cameraId, cameraName, onRegistered }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [facingMode, setFacingMode] = useState('environment');
  const [uploadCount, setUploadCount] = useState(0);
  const [log, setLog] = useState('');

  const startCamera = async (mode) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      await post('/cameras/register', { id: cameraId, name: cameraName, location: 'browser' });
      onRegistered?.(cameraId);
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
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const res = await fetch(`${BASE}/upload/${cameraId}`, {
          method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob
        });
        if (res.ok) setUploadCount(n => n + 1);
      } catch {}
    }, 'image/jpeg', 0.85);
  };

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setStatus('idle'); setLog(''); setUploadCount(0);
  };

  const switchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />
      <div className="bg-black border border-[#222] rounded-xl overflow-hidden aspect-video flex items-center justify-center">
        {status === 'streaming'
          ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          : <Icon name="camera" size={48} className="text-[#333]" />
        }
      </div>

      {status === 'idle' || status === 'error' ? (
        <button onClick={() => startCamera(facingMode)}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2">
          <Icon name="camera" size={18} />
          Start Camera
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={stopCamera}
            className="flex-1 border border-red-800 text-red-400 py-3 rounded-xl text-base flex items-center justify-center gap-2">
            <Icon name="stop" size={16} /> Stop
          </button>
          <button onClick={switchCamera}
            className="flex-1 border border-[#333] text-[#888] py-3 rounded-xl text-base flex items-center justify-center gap-2">
            <Icon name="refresh" size={16} /> Flip
          </button>
        </div>
      )}

      {log && (
        <div className={`text-sm px-4 py-3 rounded-xl flex items-center gap-2
          ${status === 'error' ? 'text-red-400 bg-red-950 border border-red-900'
            : 'text-green-400 bg-green-950 border border-green-900'}`}>
          <Icon name={status === 'error' ? 'warning' : 'check'} size={16} />
          {status === 'streaming' ? `Live — ${uploadCount} frames sent` : log}
        </div>
      )}
    </div>
  );
}
