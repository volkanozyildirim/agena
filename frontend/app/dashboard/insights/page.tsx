'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

type RelatedEvent = {
  kind: string;
  ref?: string;
  label: string;
  timestamp: string;
  source?: string;
};

type Correlation = {
  id: number;
  window_start: string;
  window_end: string;
  primary_kind: string;
  primary_ref: string;
  primary_label: string;
  related_events: RelatedEvent[] | null;
  confidence: number;
  severity: string | null;
  narrative: string | null;
  repo_mapping_id: string | null;
  acknowledged_at: string | null;
  user_verdict: string | null;
  created_at: string;
};

const KIND_ICON: Record<string, string> = {
  pr_merge: '🔀',
  deploy: '🚀',
  task_sentry: '🚨',
  task_newrelic: '📡',
  task_datadog: '🐶',
  task_appdynamics: '📊',
  task_jira: '🪐',
  task_azure_devops: '🟦',
  task_azure: '🟦',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};

export default function InsightsPage() {
  const { t } = useLocale();
  const [items, setItems] = useState<Correlation[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await apiFetch<Correlation[]>('/insights/correlations?min_confidence=70&limit=50');
      setItems(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { void load(); }, []);

  async function scanNow() {
    setScanning(true);
    try {
      await apiFetch('/insights/correlations/scan', { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  async function ack(id: number, verdict: 'confirmed' | 'false_positive' | 'noted') {
    try {
      await apiFetch(`/insights/correlations/${id}/ack`, {
        method: 'POST',
        body: JSON.stringify({ verdict }),
      });
      setItems((prev) => prev?.map((c) => c.id === id ? { ...c, user_verdict: verdict, acknowledged_at: new Date().toISOString() } : c) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--ink-90)' }}>
            {t('insights.title')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-58)', marginTop: 6, marginBottom: 0, lineHeight: 1.55 }}>
            {t('insights.subtitle')}
          </p>
        </div>
        <button
          onClick={scanNow}
          disabled={scanning}
          style={{
            padding: '10px 18px', borderRadius: 10,
            background: scanning ? 'var(--panel)' : 'linear-gradient(135deg, #6366f1, #06b6d4)',
            color: scanning ? 'var(--ink-58)' : '#fff',
            border: scanning ? '1px solid var(--panel-border)' : 'none',
            fontSize: 13, fontWeight: 700, cursor: scanning ? 'wait' : 'pointer',
          }}
        >
          {scanning ? t('insights.scanning') : t('insights.scanNow')}
        </button>
      </header>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {items === null ? (
        <div style={{ padding: 24, color: 'var(--ink-58)', fontSize: 14 }}>{t('insights.loading')}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-90)', marginBottom: 4 }}>{t('insights.empty.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-58)', maxWidth: 480, margin: '0 auto', lineHeight: 1.55 }}>
            {t('insights.empty.body')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((c) => {
            const sev = c.severity || 'medium';
            const color = SEVERITY_COLOR[sev] || '#f59e0b';
            const acked = !!c.acknowledged_at;
            return (
              <article
                key={c.id}
                style={{
                  borderRadius: 14,
                  background: 'var(--panel)',
                  border: `1px solid ${color}55`,
                  borderLeft: `4px solid ${color}`,
                  padding: 18,
                  display: 'grid',
                  gap: 12,
                  opacity: acked && c.user_verdict === 'false_positive' ? 0.55 : 1,
                }}
              >
                <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11, fontWeight: 800, color: '#fff',
                      background: color, padding: '3px 9px', borderRadius: 999,
                      textTransform: 'uppercase', letterSpacing: 0.6, flexShrink: 0,
                    }}
                  >
                    {sev} · {c.confidence}%
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-90)', flex: 1 }}>
                    {KIND_ICON[c.primary_kind] || '◉'} {c.primary_label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-58)' }}>
                    {new Date(c.window_end).toLocaleString()}
                  </span>
                </header>

                {c.narrative && (
                  <p style={{ fontSize: 13, color: 'var(--ink-78)', margin: 0, lineHeight: 1.6 }}>
                    {c.narrative}
                  </p>
                )}

                {c.related_events && c.related_events.length > 0 && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--ink-42)', textTransform: 'uppercase' }}>
                      {t('insights.timeline')}
                    </div>
                    <ol style={{ display: 'grid', gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
                      {[
                        { kind: c.primary_kind, label: c.primary_label, timestamp: c.window_start, ref: c.primary_ref },
                        ...c.related_events,
                      ]
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                        .map((evt, i) => (
                          <li
                            key={`${evt.kind}-${evt.ref || ''}-${i}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '6px 10px', borderRadius: 8,
                              background: 'rgba(99,102,241,0.06)',
                              fontSize: 12,
                            }}
                          >
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--ink-58)', flexShrink: 0, minWidth: 56 }}>
                              {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>
                              {KIND_ICON[evt.kind] || '◉'}
                            </span>
                            <span style={{ color: 'var(--ink-78)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {evt.label}
                            </span>
                          </li>
                        ))}
                    </ol>
                  </div>
                )}

                <footer style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-58)' }}>
                    {c.repo_mapping_id && <>📦 {c.repo_mapping_id}</>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {acked ? (
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700 }}>
                        ✓ {c.user_verdict || 'noted'}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => void ack(c.id, 'confirmed')}
                          style={{ padding: '5px 11px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {t('insights.confirm')}
                        </button>
                        <button
                          onClick={() => void ack(c.id, 'false_positive')}
                          style={{ padding: '5px 11px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {t('insights.falsePositive')}
                        </button>
                      </>
                    )}
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
