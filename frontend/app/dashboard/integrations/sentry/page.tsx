'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

interface SentryIssue {
  id: string;
  short_id: string | null;
  title: string;
  level: string;
  status: string | null;
  culprit: string | null;
  count: number;
  user_count: number;
  last_seen: string | null;
  permalink: string | null;
}

export default function SentryIssuesPage() {
  const { t } = useLocale();
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [query, setQuery] = useState('is:unresolved');
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [projectSlug, setProjectSlug] = useState('');

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => setMsg(''), 3000);
    return () => clearTimeout(timer);
  }, [msg]);

  async function loadIssues() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        query: query || 'is:unresolved',
        limit: String(limit),
      });
      const data = await apiFetch<{ organization_slug: string; project_slug: string; issues: SentryIssue[] }>(`/sentry/issues?${params.toString()}`);
      setIssues(data.issues || []);
      setOrgSlug(data.organization_slug || '');
      setProjectSlug(data.project_slug || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch Sentry issues');
    } finally {
      setLoading(false);
    }
  }

  async function importIssues() {
    setImporting(true);
    setError('');
    setMsg('');
    try {
      const res = await apiFetch<{ imported: number; skipped: number }>('/tasks/import/sentry', {
        method: 'POST',
        body: JSON.stringify({ query: query || 'is:unresolved', limit }),
      });
      if (res.imported === 0 && res.skipped > 0) {
        setMsg(`No new issues to import — ${res.skipped} already imported`);
      } else if (res.imported > 0 && res.skipped > 0) {
        setMsg(`${res.imported} new issue(s) imported, ${res.skipped} skipped`);
      } else if (res.imported > 0) {
        setMsg(`${res.imported} issue(s) imported as tasks`);
      } else {
        setMsg('No issues found to import');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 16,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--panel-border)',
    background: 'var(--glass)', color: 'var(--ink)', fontSize: 13,
  };
  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, border: 'none', background: '#f97316', color: '#111827',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
        {t('integrations.providerSentry')} — Issues
      </h2>

      {msg && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 12, fontWeight: 600 }}>{msg}</div>}
      {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 12, fontWeight: 600 }}>{error}</div>}

      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='is:unresolved'
            style={{ ...inputStyle, flex: 1, minWidth: 260 }}
            onKeyDown={(e) => e.key === 'Enter' && void loadIssues()}
          />
          <input
            type='number'
            min={1}
            max={100}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(100, Number(e.target.value) || 50)))}
            style={{ ...inputStyle, width: 110 }}
          />
          <button onClick={() => void loadIssues()} disabled={loading} style={btnPrimary}>
            {loading ? '...' : 'Fetch'}
          </button>
          <button onClick={() => void importIssues()} disabled={importing} style={btnPrimary}>
            {importing ? '...' : 'Import as Tasks'}
          </button>
        </div>
        {(orgSlug || projectSlug) && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-45)' }}>
            Scope: <strong>{orgSlug || '-'}</strong> / <strong>{projectSlug || '-'}</strong>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-65)', marginBottom: 8 }}>
          Issues ({issues.length})
        </div>
        {issues.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ink-35)', padding: 8 }}>No issues loaded.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {issues.map((issue) => (
              <div key={issue.id} style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 8, background: 'var(--glass)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{(issue.level || 'error').toUpperCase()}</span>
                  {issue.short_id && <span style={{ fontSize: 11, color: 'var(--ink-45)' }}>{issue.short_id}</span>}
                  <span style={{ fontSize: 11, color: 'var(--ink-35)' }}>events: {issue.count} • users: {issue.user_count}</span>
                  {issue.status && <span style={{ fontSize: 11, color: 'var(--ink-35)' }}>status: {issue.status}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{issue.title}</div>
                {issue.culprit && <div style={{ fontSize: 11, color: 'var(--ink-45)' }}>{issue.culprit}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-30)' }}>{issue.last_seen || '-'}</span>
                  {issue.permalink && (
                    <a href={issue.permalink} target='_blank' rel='noreferrer' style={{ fontSize: 11, color: '#f97316', textDecoration: 'none' }}>
                      Open in Sentry ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
