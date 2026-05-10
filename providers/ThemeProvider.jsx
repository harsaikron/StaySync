'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('staysync-theme') || 'light';
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } catch {}
  }, []);

  const setTheme = (t) => {
    setThemeState(t);
    try {
      localStorage.setItem('staysync-theme', t);
      document.documentElement.setAttribute('data-theme', t);
    } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
