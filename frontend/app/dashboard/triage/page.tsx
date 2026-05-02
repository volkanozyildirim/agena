'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

type Decision = {
  id: number;
  task_id: number;
  source: string;
  external_id: string;
  ticket_title: string | null;
  idle_days: number;
  ai_verdict: string | null;
  ai_confidence: number;
  ai_reasoning: string | null;
  status: string;
  applied_verdict: string | null;
  applied_at: string | null;
  created_at: string;
};

type Settings = {
  triage_enabled: boolean;
  triage_idle_days: number;
  triage_schedule_cron: string;
  triage_sources: string;
  backlog_enabled: boolean;
  backlog_warn_hours: number;
  backlog_critical_hours: number;
  backlog_nudge_interval_hours: number;
  backlog_channel: string;
  backlog_exempt_repos: string | null;
};

const VERDICT_COLOR: Record<string, string> = {
  close: '#10b981',
  snooze: '#f59e0b',
  keep: '#6366f1',
};

const VERDICT_ICON: Record<string, string> = {
  close: '✓',
  snooze: '⏸',
  keep: '⛔',
};

const SOURCE_ICON: Record<string, string> = {
  jira: '🪐',
  azure_devops: '🟦',
  azure: '🟦',
};

export default function TriagePage() {
  const { t } = useLocale();
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await apiFetch<Decision[]>('/triage/decisions?status=pending&limit=200');
      setDecisions(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadSettings() {
    try {
      const s = await apiFetch<Settings>('/workflow-settings');
      setSettings(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { void load(); void loadSettings(); }, []);

  async function scanNow() {
    setScanning(true);
    try {
      await apiFetch('/triage/scan', { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  async function applyOne(id: number, verdict: string) {
    try {
      await apiFetch(`/triage/decisions/${id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ verdict }),
      });
      setDecisions((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function skipOne(id: number) {
    try {
      await apiFetch(`/triage/decisions/${id}/skip`, { method: 'POST' });
      setDecisions((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function applyAll() {
    if (!decisions || decisions.length === 0) return;
    try {
      const res = await apiFetch<{ applied: number }>('/triage/apply-all-ai-suggestions', {
        method: 'POST',
        body: JSON.stringify({ decision_ids: decisions.map((d) => d.id) }),
      });
      await load();
      alert(`${res.applied} ${t('triage.applied')}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveSettings(partial: Partial<Settings>) {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const updated = await apiFetch<Settings>('/workflow-settings', {
        method: 'PUT',
        body: JSON.stringify(partial),
      });
      setSettings(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, margin: 0, color: 'var(--ink-90)', lineHeight: 1.2 }}>
            🧹 {t('triage.title')}
          </h1>
          <p style={{ fontSize: 'clamp(12px, 3.4vw, 14px)', color: 'var(--ink-58)', marginTop: 6, lineHeight: 1.5 }}>
            {t('triage.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={scanNow}
            disabled={scanning}
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: scanning ? 'var(--panel)' : 'linear-gradient(135deg, #10b981, #06b6d4)',
              color: scanning ? 'var(--ink-58)' : '#fff',
              border: scanning ? '1px solid var(--panel-border)' : 'none',
              fontSize: 12, fontWeight: 700, cursor: scanning ? 'wait' : 'pointer',
            }}
          >
            {scanning ? t('triage.scanning') : t('triage.scanNow')}
          </button>
          {decisions && decisions.length > 0 && (
            <button
              onClick={() => void applyAll()}
              style={{
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(16,185,129,0.12)', color: '#10b981',
                border: '1px solid rgba(16,185,129,0.3)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              ✓✓ {t('triage.applyAll')} ({decisions.length})
            </button>
          )}
          <button
            onClick={() => setShowSettings((v) => !v)}
            style={{
              padding: '8px 12px', borderRadius: 10,
              background: showSettings ? 'rgba(99,102,241,0.12)' : 'var(--panel)',
              color: showSettings ? '#818cf8' : 'var(--ink-78)',
              border: '1px solid var(--panel-border)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⚙ {t('triage.settings')}
          </button>
        </div>
      </header>

      {showSettings && settings && (
        <section style={{ padding: 18, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--panel-border)', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13 }}>⚙ {t('triage.settingsTitle')}</strong>
            {savingSettings && <span style={{ fontSize: 11, color: 'var(--ink-58)' }}>{t('common.saving')}</span>}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <input
              type='checkbox'
              checked={settings.triage_enabled}
              onChange={(e) => void saveSettings({ triage_enabled: e.target.checked })}
            />
            {t('triage.set.enabled')}
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            <span>{t('triage.set.idleDays')}</span>
            <input
              type='number' min={1} max={365}
              value={settings.triage_idle_days}
              onChange={(e) => void saveSettings({ triage_idle_days: parseInt(e.target.value) || 30 })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid var(--panel-border)', background: 'var(--surface)', color: 'var(--ink)', maxWidth: 120 }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            <span>{t('triage.set.sources')}</span>
            <input
              type='text'
              value={settings.triage_sources}
              onChange={(e) => void saveSettings({ triage_sources: e.target.value })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid var(--panel-border)', background: 'var(--surface)', color: 'var(--ink)' }}
              placeholder='jira,azure_devops'
            />
            <span style={{ fontSize: 11, color: 'var(--ink-58)' }}>{t('triage.set.sourcesHint')}</span>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            <span>{t('triage.set.cron')}</span>
            <input
              type='text'
              value={settings.triage_schedule_cron}
              onChange={(e) => void saveSettings({ triage_schedule_cron: e.target.value })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid var(--panel-border)', background: 'var(--surface)', color: 'var(--ink)', maxWidth: 200, fontFamily: 'ui-monospace, monospace' }}
              placeholder='0 18 * * 0'
            />
          </label>
        </section>
      )}

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {decisions === null ? (
        <div style={{ padding: 24, color: 'var(--ink-58)', fontSize: 14 }}>{t('triage.loading')}</div>
      ) : decisions.length === 0 ? (
        <div style={{ padding: 32, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-90)', marginBottom: 4 }}>{t('triage.empty.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-58)', maxWidth: 480, margin: '0 auto', lineHeight: 1.55 }}>
            {t('triage.empty.body')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {decisions.map((d) => {
            const verdict = d.ai_verdict || 'keep';
            const color = VERDICT_COLOR[verdict] || '#6366f1';
            return (
              <article
                key={d.id}
                style={{
                  borderRadius: 12,
                  background: 'var(--panel)',
                  border: '1px solid var(--panel-border)',
                  borderLeft: `4px solid ${color}`,
                  padding: 14,
                  display: 'grid',
                  gap: 8,
                }}
              >
                <header style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{SOURCE_ICON[d.source] || '📋'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-58)', fontFamily: 'ui-monospace, monospace' }}>
                    {d.external_id}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 700 }}>
                    {d.idle_days} {t('triage.daysIdle')}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: `${color}22`, color, fontWeight: 700 }}>
                    {VERDICT_ICON[verdict]} AI: {verdict} · {d.ai_confidence}%
                  </span>
                </header>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-90)' }}>
                  {d.ticket_title || '(no title)'}
                </div>
                {d.ai_reasoning && (
                  <p style={{ fontSize: 12, color: 'var(--ink-58)', margin: 0, lineHeight: 1.55, fontStyle: 'italic' }}>
                    🤖 {d.ai_reasoning}
                  </p>
                )}
                <footer style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => void applyOne(d.id, verdict)}
                    style={{ padding: '5px 11px', borderRadius: 8, background: `${color}22`, color, border: `1px solid ${color}55`, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ✓✓ {t('triage.applyAi')}
                  </button>
                  <button
                    onClick={() => void applyOne(d.id, 'close')}
                    style={{ padding: '5px 11px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ✓ {t('triage.close')}
                  </button>
                  <button
                    onClick={() => void applyOne(d.id, 'snooze')}
                    style={{ padding: '5px 11px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ⏸ {t('triage.snooze')}
                  </button>
                  <button
                    onClick={() => void applyOne(d.id, 'keep')}
                    style={{ padding: '5px 11px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ⛔ {t('triage.keep')}
                  </button>
                  <button
                    onClick={() => void skipOne(d.id)}
                    style={{ padding: '5px 11px', borderRadius: 8, background: 'transparent', color: 'var(--ink-58)', border: '1px solid var(--panel-border)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ↩ {t('triage.skip')}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
