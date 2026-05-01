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
  // Default: hide cluster the user already triaged. They can flip to "all"
  // to see the full audit log of correlations the engine has found.
  const [showAcked, setShowAcked] = useState(false);

  async function load() {
    try {
      const rows = await apiFetch<Correlation[]>('/insights/correlations?min_confidence=70&limit=200');
      setItems(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { void load(); }, []);

  const visibleItems = items?.filter((c) => showAcked || !c.acknowledged_at) ?? null;
  const hiddenAckedCount = items && !showAcked ? items.filter((c) => c.acknowledged_at).length : 0;

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

  async function undoAck(id: number) {
    try {
      await apiFetch(`/insights/correlations/${id}/unack`, { method: 'POST' });
      setItems((prev) => prev?.map((c) => c.id === id ? { ...c, user_verdict: null, acknowledged_at: null } : c) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, margin: 0, color: 'var(--ink-90)', lineHeight: 1.2 }}>
            {t('insights.title')}
          </h1>
          <p style={{ fontSize: 'clamp(12px, 3.4vw, 14px)', color: 'var(--ink-58)', marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
            {t('insights.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={scanNow}
            disabled={scanning}
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: scanning ? 'var(--panel)' : 'linear-gradient(135deg, #6366f1, #06b6d4)',
              color: scanning ? 'var(--ink-58)' : '#fff',
              border: scanning ? '1px solid var(--panel-border)' : 'none',
              fontSize: 12, fontWeight: 700, cursor: scanning ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {scanning ? t('insights.scanning') : t('insights.scanNow')}
          </button>
          <button
            onClick={() => setShowAcked((v) => !v)}
            style={{
              padding: '8px 12px', borderRadius: 10,
              background: showAcked ? 'rgba(99,102,241,0.12)' : 'var(--panel)',
              color: showAcked ? '#818cf8' : 'var(--ink-78)',
              border: `1px solid ${showAcked ? 'rgba(99,102,241,0.3)' : 'var(--panel-border)'}`,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {showAcked ? t('insights.hideAcked') : t('insights.showAcked')}
            {hiddenAckedCount > 0 && !showAcked ? ` (${hiddenAckedCount})` : ''}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {visibleItems === null ? (
        <div style={{ padding: 24, color: 'var(--ink-58)', fontSize: 14 }}>{t('insights.loading')}</div>
      ) : visibleItems.length === 0 ? (
        <div style={{ padding: 24, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-90)', marginBottom: 4 }}>{t('insights.empty.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-58)', maxWidth: 460, margin: '0 auto', lineHeight: 1.55 }}>
            {t('insights.empty.body')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {visibleItems.map((c) => {
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
                  padding: 'clamp(12px, 3vw, 18px)',
                  display: 'grid',
                  gap: 10,
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
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 10px', borderRadius: 8,
                              background: 'rgba(99,102,241,0.06)',
                              fontSize: 12,
                            }}
                          >
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--ink-58)', flexShrink: 0, minWidth: 44 }}>
                              {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>
                              {KIND_ICON[evt.kind] || '◉'}
                            </span>
                            <span style={{ color: 'var(--ink-78)', flex: 1, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.35 }}>
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
                      <>
                        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: c.user_verdict === 'false_positive' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.1)', color: c.user_verdict === 'false_positive' ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                          {c.user_verdict === 'false_positive' ? '✗' : '✓'} {c.user_verdict || 'noted'}
                        </span>
                        <button
                          onClick={() => void undoAck(c.id)}
                          style={{ padding: '5px 11px', borderRadius: 8, background: 'transparent', color: 'var(--ink-58)', border: '1px solid var(--panel-border)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          ↩ {t('insights.undo')}
                        </button>
                      </>
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
