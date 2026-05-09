'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import { speakText, cancelSpeech } from '@/lib/tts';

const TTSContext = createContext(null);

export function TTSProvider({ children }) {
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [lastMessage, setLastMessage] = useState('');

  const speak = useCallback((text) => {
    setLastMessage(text);
    speakText(text);
  }, []);

  const repeat = useCallback(() => {
    if (lastMessage) speakText(lastMessage);
  }, [lastMessage]);

  return (
    <TTSContext.Provider value={{ speak, repeat, autoSpeak, setAutoSpeak, lastMessage, cancelSpeech }}>
      {children}
    </TTSContext.Provider>
  );
}

export const useTTS = () => useContext(TTSContext);
