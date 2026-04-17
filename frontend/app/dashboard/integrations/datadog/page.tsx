'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

interface DatadogIssue {
  id: string;
  attributes: {
    title?: string;
    type?: string;
    status?: string;
    service?: string;
    env?: string;
    occurrences?: number;
    impacted_users?: number;
    first_seen?: string;
    last_seen?: string;
  };
}

interface RepoMapping {
  id: number;
  provider: string;
  owner: string;
  repo_name: string;
}

export default function DatadogPage() {
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [issues, setIssues] = useState<DatadogIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [query, setQuery] = useState('status:open');
  const [repos, setRepos] = useState<RepoMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  useEffect(() => {
    void loadRepos();
    if (!msg) return;
    const timer = setTimeout(() => setMsg(''), 3000);
    return () => clearTimeout(timer);
  }, [msg]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  async function loadRepos() {
    try {
      const data = await apiFetch<RepoMapping[]>('/repo-mappings');
      setRepos(data);
    } catch {}
  }

  async function fetchIssues() {
    setIssuesLoading(true);
    setError('');
    try {
      const data = await apiFetch<DatadogIssue[]>('/datadog/issues?query=' + encodeURIComponent(query));
      setIssues(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch issues');
    } finally {
      setIssuesLoading(false);
    }
  }

  async function importAll() {
    setImporting(true);
    setError('');
    try {
      const result = await apiFetch<{ imported: number; skipped: number }>('/tasks/import/datadog', {
        method: 'POST',
        body: JSON.stringify({ query, limit: 50 }),
      });
      setImportResult(result);
      setMsg(`Imported ${result.imported} issues, ${result.skipped} skipped`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-90)', margin: 0 }}>
          <span style={{ marginRight: 8 }}>🐶</span>Datadog Error Tracking
        </h1>
        <p style={{ fontSize: 12, color: 'var(--ink-40)', marginTop: 4 }}>
          Import error tracking issues from Datadog and let AI agents fix them automatically.
        </p>
      </div>

      {/* Toast */}
      {(msg || error) && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          color: error ? '#fecaca' : '#86efac',
          background: error ? 'rgba(127,29,29,0.9)' : 'rgba(20,83,45,0.9)',
          border: error ? '1px solid rgba(248,113,113,0.35)' : '1px solid rgba(34,197,94,0.35)',
        }}>
          {error || msg}
        </div>
      )}

      {/* Query + Fetch */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="status:open service:my-app"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--ink)', outline: 'none' }}
        />
        <button onClick={fetchIssues} disabled={issuesLoading}
          style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: '#632ca6', color: '#fff', cursor: 'pointer' }}>
          {issuesLoading ? 'Loading...' : 'Fetch Issues'}
        </button>
        <button onClick={importAll} disabled={importing}
          style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid #632ca6', background: 'transparent', color: '#632ca6', cursor: 'pointer' }}>
          {importing ? 'Importing...' : 'Import All'}
        </button>
      </div>

      {/* Import result */}
      {importResult && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(99,44,166,0.08)', border: '1px solid rgba(99,44,166,0.2)', fontSize: 12 }}>
          <strong style={{ color: '#632ca6' }}>{importResult.imported}</strong> imported,{' '}
          <strong style={{ color: 'var(--ink-40)' }}>{importResult.skipped}</strong> skipped (already exists)
        </div>
      )}

      {/* Issues list */}
      {issues.length > 0 && (
        <div style={{ borderRadius: 12, border: '1px solid var(--panel-border)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--panel-border)', background: 'var(--panel)', display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 100px', gap: 8, fontSize: 10, fontWeight: 700, color: 'var(--ink-35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <span>Error</span>
            <span>Service</span>
            <span>Status</span>
            <span>Count</span>
            <span>Last Seen</span>
          </div>
          {issues.map((issue) => {
            const a = issue.attributes || {};
            return (
              <div key={issue.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--panel-border)', display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 100px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-78)', fontWeight: 600 }}>
                  {a.title || issue.id}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-50)' }}>{a.service || '—'}</div>
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                    background: a.status === 'open' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    color: a.status === 'open' ? '#ef4444' : '#22c55e',
                  }}>{a.status || '?'}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-50)' }}>{a.occurrences ?? '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-35)' }}>
                  {a.last_seen ? new Date(a.last_seen).toLocaleDateString() : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {issues.length === 0 && !issuesLoading && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--ink-25)', fontSize: 13 }}>
          Click "Fetch Issues" to load Datadog error tracking issues.
        </div>
      )}

      {/* Repo mappings info */}
      {repos.length > 0 && (
        <div style={{ borderRadius: 10, border: '1px solid var(--panel-border)', padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-35)', marginBottom: 8 }}>Available Repo Mappings</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {repos.map((r) => (
              <span key={r.id} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--panel)', border: '1px solid var(--panel-border)', color: 'var(--ink-50)' }}>
                {r.provider}:{r.owner}/{r.repo_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
