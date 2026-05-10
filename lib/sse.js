function getBase() {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return (
    localStorage.getItem('staysync-backend-url') ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  ).replace(/\/$/, '');
}

export function createSSEConnection(cameraId, onMessage) {
  if (typeof window === 'undefined') return () => {};
  const base = getBase();
  // Don't try to connect to localhost when running on a public domain
  const onPublicHost = !window.location.hostname.includes('localhost');
  const isLocalUrl = base.includes('localhost') || base.includes('127.0.0.1');
  if (onPublicHost && isLocalUrl) return () => {};

  const es = new EventSource(`${base}/stream/${cameraId}`);
  es.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  es.onerror = () => {};  // Backend offline is expected — suppress console noise
  return () => es.close();
}
