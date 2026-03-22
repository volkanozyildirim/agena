'use client';

import { useEffect, useRef } from 'react';
import { apiFetch, loadPrefs } from '@/lib/api';

type TaskLite = {
  id: number;
  title: string;
  status: string;
};

const LS_STATUS_KEY = 'tiqr_last_task_status_map';

function loadLastMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_STATUS_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function saveLastMap(map: Record<string, string>): void {
  localStorage.setItem(LS_STATUS_KEY, JSON.stringify(map));
}

export default function WebPushBridge() {
  const initialized = useRef(false);
  const enabledRef = useRef(true);

  useEffect(() => {
    loadPrefs().then((prefs) => {
      const profile = (prefs.profile_settings || {}) as Record<string, unknown>;
      enabledRef.current = profile.web_push_notifications !== false;
      if (enabledRef.current && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled || !enabledRef.current) return;
      try {
        const res = await apiFetch<{ items: TaskLite[]; total: number; page: number; page_size: number }>('/tasks/search?page=1&page_size=25');
        const items = res.items || [];
        const prev = loadLastMap();
        const next: Record<string, string> = {};
        for (const t of items) {
          const id = String(t.id);
          const old = prev[id];
          next[id] = t.status;
          if (!initialized.current) continue;
          if (old === t.status) continue;
          if (t.status !== 'completed' && t.status !== 'failed') continue;
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const prefix = t.status === 'completed' ? 'Completed' : 'Failed';
            new Notification(`Task ${prefix}`, { body: `#${t.id} ${t.title}` });
          }
        }
        saveLastMap({ ...prev, ...next });
        initialized.current = true;
      } catch {
        // no-op
      }
    };

    void poll();
    const iv = setInterval(() => void poll(), 12000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  return null;
}
