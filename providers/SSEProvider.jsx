'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSSEConnection } from '@/lib/sse';
import { useTTS } from './TTSProvider';

const SSEContext = createContext(null);

export function SSEProvider({ cameraIds = [], children }) {
  const [latestEvents, setLatestEvents] = useState({});
  const [activeAlerts, setActiveAlerts] = useState([]);
  const { speak, autoSpeak } = useTTS();

  const subscribe = useCallback((cameraId) => {
    return createSSEConnection(cameraId, (data) => {
      if (data.type !== 'analysis') return;
      setLatestEvents(prev => ({ ...prev, [cameraId]: data }));
      if (data.severity === 'medium' || data.severity === 'critical') {
        setActiveAlerts(prev => [{ ...data, cameraId, id: Date.now() }, ...prev.slice(0, 9)]);
      }
      if (autoSpeak && data.guidance) speak(data.guidance);
    });
  }, [autoSpeak, speak]);

  useEffect(() => {
    const cleanups = cameraIds.map(subscribe);
    return () => cleanups.forEach(fn => fn());
  }, [JSON.stringify(cameraIds), subscribe]);

  return (
    <SSEContext.Provider value={{ latestEvents, activeAlerts, setActiveAlerts }}>
      {children}
    </SSEContext.Provider>
  );
}

export const useSSE = () => useContext(SSEContext);
