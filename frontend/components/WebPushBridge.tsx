'use client';

import { useEffect, useRef } from 'react';
import { loadPrefs } from '@/lib/api';
import { useWS } from '@/lib/useWebSocket';

const NOTIF_EVENT = 'agena:notification';

function playNotificationTone(): void {
  if (typeof window === 'undefined') return;
  const AudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.24);
    window.setTimeout(() => void ctx.close(), 320);
  } catch {
    // no-op
  }
}

export default function WebPushBridge() {
  const enabledRef = useRef(true);
  const { lastEvent } = useWS();

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
    if (!lastEvent || !enabledRef.current) return;
    if (lastEvent.event !== 'task_status') return;

    const data = lastEvent.data as { task_id?: number; status?: string; title?: string } | undefined;
    if (!data) return;

    const { task_id, status, title } = data;
    if (status !== 'completed' && status !== 'failed') return;

    // Dispatch custom event for other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NOTIF_EVENT, { detail: { taskId: task_id, status, title } }));
    }

    playNotificationTone();

    // Show native browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const prefix = status === 'completed' ? 'Completed' : 'Failed';
      const icon = status === 'completed' ? '/media/agena-logo.svg' : undefined;
      new Notification(`Task ${prefix}`, {
        body: `#${task_id} ${title || ''}`,
        icon,
        tag: `agena-task-${task_id}`,
      });
    }
  }, [lastEvent]);

  return null;
}
