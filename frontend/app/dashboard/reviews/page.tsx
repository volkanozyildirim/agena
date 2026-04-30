'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

interface Review {
  id: number;
  task_id: number;
  task_title: string | null;
  reviewer_agent_role: string;
  reviewer_provider: string | null;
  reviewer_model: string | null;
  input_snapshot: string | null;
  output: string | null;
  score: number | null;
  findings_count: number | null;
  severity: string | null;
  status: string;
  error_message: string | null;
  requested_by_user_id: number;
  created_at: string;
  completed_at: string | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#60a5fa',
  clean: '#22c55e',
};

function severityColor(s: string | null) {
  if (!s) return 'var(--ink-35)';
  return SEVERITY_COLOR[s] || 'var(--ink-35)';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ReviewsPage() {
  const { t } = useLocale();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    void load();
  }, [filterRole, filterSeverity]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterRole) params.set('agent_role', filterRole);
      if (filterSeverity) params.set('severity', filterSeverity);
      const data = await apiFetch<Review[]>(`/reviews?${params}`);
      setReviews(data);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const byRole: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let totalScore = 0, scoreCount = 0;
    for (const r of reviews) {
      byRole[r.reviewer_agent_role] = (byRole[r.reviewer_agent_role] ?? 0) + 1;
      if (r.severity) bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
      if (r.score != null) { totalScore += r.score; scoreCount++; }
    }
    const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : null;
    return { byRole, bySeverity, avgScore };
  }, [reviews]);

  const allRoles = Array.from(new Set(reviews.map((r) => r.reviewer_agent_role)));

  const cardStyle: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 16 };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16,
        border: '1px solid var(--panel-border)', background: 'var(--panel)',
        backgroundImage: 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(99,102,241,0.12) 60%, rgba(56,189,248,0.06))',
        padding: '20px 22px',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #a855f7, #6366f1, #38bdf8)' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.4)', fontSize: 22 }}>🔎</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', letterSpacing: -0.3 }}>{t('reviews.title') || 'Code Reviews'}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-58)', marginTop: 3, lineHeight: 1.5 }}>
              {t('reviews.heroSubtitle') || 'AI-driven adversarial code reviews. Track findings, severities, and per-agent verdict history without touching the code.'}
            </div>
          </div>
        </div>

        {reviews.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { label: t('reviews.statTotal') || 'Reviews', value: reviews.length, color: 'var(--ink)' },
              { label: t('reviews.statAgents') || 'Reviewer agents', value: Object.keys(stats.byRole).length, color: '#60a5fa' },
              { label: t('reviews.statAvgScore') || 'Avg score', value: stats.avgScore != null ? `${stats.avgScore}` : '—', color: stats.avgScore != null && stats.avgScore >= 70 ? '#22c55e' : '#eab308' },
              { label: t('reviews.statCritical') || 'Critical', value: stats.bySeverity['critical'] ?? 0, color: '#ef4444' },
            ].map((tile) => (
              <div key={tile.label} style={{ flex: 1, minWidth: 130, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-border)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-35)' }}>{tile.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: tile.color, marginTop: 4 }}>{tile.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={cardStyle}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-35)', marginBottom: 8 }}>{t('reviews.filtersLabel') || 'Filter reviews'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, border: '1px solid var(--panel-border)', background: 'var(--glass)', color: 'var(--ink)', height: 36 }}>
            <option value=''>{t('reviews.allRoles') || 'All reviewers'}</option>
            {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, border: '1px solid var(--panel-border)', background: 'var(--glass)', color: 'var(--ink)', height: 36 }}>
            <option value=''>{t('reviews.allSeverities') || 'All severities'}</option>
            {['critical', 'high', 'medium', 'low', 'clean'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Reviews list */}
      <div style={cardStyle}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-35)', marginBottom: 12 }}>
          {(t('reviews.count') || '{n} reviews').replace('{n}', String(reviews.length))}
        </div>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--ink-35)', padding: 16, textAlign: 'center' }}>{t('integrations.common.loading') || 'Loading...'}</div>
        ) : reviews.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', borderRadius: 12, background: 'var(--glass)', border: '1px dashed var(--panel-border)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔎</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{t('reviews.emptyTitle') || 'No reviews yet'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-50)', marginTop: 4 }}>
              {t('reviews.emptyHint') || 'Hit the 🔎 Review button on any task to run a reviewer agent against it.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {reviews.map((r) => {
              const isOpen = openId === r.id;
              return (
                <div key={r.id} style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: 'var(--glass)', border: `1px solid ${isOpen ? 'rgba(168,85,247,0.5)' : 'var(--panel-border)'}`,
                }}>
                  <div onClick={() => setOpenId(isOpen ? null : r.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${severityColor(r.severity)}1f`, border: `1px solid ${severityColor(r.severity)}66`, fontSize: 16 }}>
                      {r.severity === 'critical' ? '🚨' : r.severity === 'clean' ? '✅' : '🔎'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{r.task_title || `Task #${r.task_id}`}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>{r.reviewer_agent_role}</span>
                        {r.severity && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: `${severityColor(r.severity)}1f`, color: severityColor(r.severity), textTransform: 'uppercase' }}>{r.severity}</span>}
                        {r.status === 'failed' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>FAILED</span>}
                        {r.status === 'running' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>RUNNING…</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-50)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span>#{r.id}</span>
                        {r.findings_count != null && <span><strong style={{ color: severityColor(r.severity) }}>{r.findings_count}</strong> findings</span>}
                        {r.score != null && <span>score: <strong>{r.score}</strong>/100</span>}
                        <span>{timeAgo(r.created_at)}</span>
                        {r.reviewer_model && <span style={{ fontFamily: 'monospace', color: 'var(--ink-35)' }}>{r.reviewer_model}</span>}
                      </div>
                    </div>
                    <Link href={`/tasks/${r.task_id}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)' }}>
                      Task →
                    </Link>
                    <span style={{ fontSize: 14, color: 'var(--ink-35)' }}>{isOpen ? '▾' : '▸'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--panel-border)' }}>
                      {r.input_snapshot && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-35)', marginBottom: 4 }}>Input snapshot</div>
                          <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: 'var(--ink-78)', background: 'var(--panel)', padding: '8px 10px', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{r.input_snapshot}</pre>
                        </div>
                      )}
                      {r.error_message && (
                        <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>
                          {r.error_message}
                        </div>
                      )}
                      {r.output ? (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-35)', marginBottom: 4 }}>Reviewer output</div>
                          <pre style={{ margin: 0, fontSize: 12, fontFamily: 'inherit', color: 'var(--ink-78)', background: 'var(--panel)', padding: '12px 14px', borderRadius: 8, whiteSpace: 'pre-wrap', maxHeight: 480, overflowY: 'auto', lineHeight: 1.55 }}>{r.output}</pre>
                        </div>
                      ) : r.status === 'completed' ? (
                        <div style={{ fontSize: 11, color: 'var(--ink-35)' }}>(empty output)</div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
