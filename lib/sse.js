const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function createSSEConnection(cameraId, onMessage) {
  if (typeof window === 'undefined') return () => {};
  const es = new EventSource(`${BASE}/stream/${cameraId}`);
  es.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  es.onerror = () => console.warn(`SSE error for camera ${cameraId}`);
  return () => es.close();
}
