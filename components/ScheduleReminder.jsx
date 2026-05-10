'use client';
import { useEffect, useRef } from 'react';
import { get } from '@/lib/api';
import { speakText } from '@/lib/tts';

const ANNOUNCE_WINDOW_MINS = 2; // speak if within 2 minutes of scheduled time

const ROUTINE_ANNOUNCEMENTS = {
  wake:      (name) => `Good morning${name ? ', ' + name : ''}! It's time to wake up. Take your time getting up slowly.`,
  breakfast: (name) => `${name ? name + ', it' : 'It'}'s breakfast time! A warm meal is waiting for you.`,
  medicine:  (name) => `${name ? name + ', r' : 'R'}emember your morning tablets! Your medication is ready — please take them now.`,
  lunch:     (name) => `${name ? name + ', it' : 'It'}'s lunchtime! Time for a nice midday meal.`,
  dinner:    (name) => `${name ? name + ', d' : 'D'}inner is ready! Time to sit down and enjoy your evening meal.`,
  sleep:     (name) => `${name ? name + ', it' : 'It'}'s nearly bedtime. Time to wind down and get some rest.`,
};

function timeToMinutes(timeStr) {
  if (!timeStr) return -1;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function ScheduleReminder() {
  const announcedRef = useRef(new Set()); // track already-announced keys this session

  useEffect(() => {
    let patients = [];

    const loadPatients = async () => {
      try { patients = await get('/patients'); } catch {}
    };

    const checkSchedule = () => {
      const now = nowMinutes();
      for (const patient of patients) {
        const routine = patient.routine || {};
        for (const [key, timeStr] of Object.entries(routine)) {
          if (!timeStr) continue;
          const scheduled = timeToMinutes(timeStr);
          if (scheduled < 0) continue;

          const key_today = `${patient.id}-${key}-${new Date().toDateString()}`;
          if (announcedRef.current.has(key_today)) continue;

          const diff = scheduled - now;
          if (diff >= 0 && diff <= ANNOUNCE_WINDOW_MINS) {
            announcedRef.current.add(key_today);
            const fn = ROUTINE_ANNOUNCEMENTS[key];
            if (fn) {
              const msg = fn(patient.name?.split(' ')[0]);
              setTimeout(() => speakText(msg), 500);
            }
          }
        }
      }
    };

    loadPatients().then(() => {
      // Check immediately and then every 60 seconds
      checkSchedule();
    });

    const interval = setInterval(() => {
      if (patients.length === 0) loadPatients();
      checkSchedule();
    }, 60 * 1000);

    // Reload patients every 10 minutes in case profile changed
    const reloadInterval = setInterval(loadPatients, 10 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(reloadInterval);
    };
  }, []);

  return null;
}
