'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

interface RepoMapping {
  id: number;
  provider: string;
  owner: string;
  repo_name: string;
}

export default function AppDynamicsPage() {
  const { t } = useLocale();
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [repos, setRepos] = useState<RepoMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [appName, setAppName] = useState('');

  useEffect(() => {
    apiFetch<RepoMapping[]>('/repo-mappings').then(setRepos).catch(() => {});
  }, []);

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => setMsg(''), 3000);
    return () => clearTimeout(timer);
  }, [msg]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  async function importErrors() {
    setImporting(true);
    setError('');
    try {
      const result = await apiFetch<{ imported: number; skipped: number }>('/tasks/import/appdynamics', {
        method: 'POST',
        body: JSON.stringify({ app_name: appName || undefined, limit: 50 }),
      });
      setImportResult(result);
      setMsg(`Imported ${result.imported} errors, ${result.skipped} skipped`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-90)', margin: 0 }}>
          <span style={{ marginRight: 8 }}>📊</span>AppDynamics Error Tracking
        </h1>
        <p style={{ fontSize: 12, color: 'var(--ink-40)', marginTop: 4 }}>
          Import error snapshots from AppDynamics and let AI agents fix them automatically.
        </p>
      </div>

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

      <div style={{ display: 'grid', gap: 10, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--panel-border)', background: 'var(--surface)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-35)' }}>Import Settings</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Application name (optional, uses config default)"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--ink)', outline: 'none' }}
          />
          <button onClick={importErrors} disabled={importing}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: '#00b4d8', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {importing ? 'Importing...' : 'Import Errors'}
          </button>
        </div>
      </div>

      {importResult && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.2)', fontSize: 12 }}>
          <strong style={{ color: '#00b4d8' }}>{importResult.imported}</strong> imported,{' '}
          <strong style={{ color: 'var(--ink-40)' }}>{importResult.skipped}</strong> skipped
        </div>
      )}

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

      <div style={{ padding: '16px', borderRadius: 12, border: '1px dashed var(--panel-border)', textAlign: 'center', color: 'var(--ink-30)', fontSize: 12 }}>
        <p>Configure AppDynamics in <a href="/dashboard/integrations" style={{ color: '#00b4d8' }}>Integrations</a> first.</p>
        <p style={{ fontSize: 11, marginTop: 4 }}>Required: Controller URL, API Token, Application ID</p>
      </div>
    </div>
  );
}
