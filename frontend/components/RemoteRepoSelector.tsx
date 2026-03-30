'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AzureProject = { id: string; name: string };
type AzureRepo = { id: string; name: string; remote_url: string };
type GitHubRepo = { id: number; name: string; default_branch: string; private: boolean };

export type RemoteRepoSelection = {
  provider: 'github' | 'azure';
  project?: string;
  repo: string;
  branch: string;
  repoUrl?: string;
  /** "github:owner/repo@branch" or "azure:project/repo@branch" */
  meta: string;
};

type Props = {
  onChange: (selection: RemoteRepoSelection | null) => void;
  accent?: string;
  compact?: boolean;
};

export default function RemoteRepoSelector({ onChange, accent = '#5eead4', compact = false }: Props) {
  const [provider, setProvider] = useState<'github' | 'azure'>('azure');
  const [azureProjects, setAzureProjects] = useState<AzureProject[]>([]);
  const [azureRepos, setAzureRepos] = useState<AzureRepo[]>([]);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [loading, setLoading] = useState(true);
  const [hasAzure, setHasAzure] = useState(false);
  const [hasGithub, setHasGithub] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<AzureProject[]>('/tasks/azure/projects').catch(() => []),
      apiFetch<GitHubRepo[]>('/tasks/github/repos').catch(() => []),
    ]).then(([azP, ghR]) => {
      setAzureProjects(azP);
      setGithubRepos(ghR);
      setHasAzure(azP.length > 0);
      setHasGithub(ghR.length > 0);
      if (!azP.length && ghR.length) setProvider('github');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (provider !== 'azure' || !selectedProject) { setAzureRepos([]); return; }
    apiFetch<AzureRepo[]>('/tasks/azure/repos?project=' + encodeURIComponent(selectedProject))
      .then(setAzureRepos).catch(() => setAzureRepos([]));
  }, [provider, selectedProject]);

  useEffect(() => {
    if (!selectedRepo) { onChange(null); return; }
    if (provider === 'github') {
      onChange({ provider: 'github', repo: selectedRepo, branch, meta: `github:${selectedRepo}@${branch}` });
    } else {
      const azR = azureRepos.find((r) => r.name === selectedRepo);
      onChange({
        provider: 'azure', project: selectedProject, repo: selectedRepo, branch,
        repoUrl: azR?.remote_url,
        meta: `azure:${selectedProject}/${selectedRepo}@${branch}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, selectedProject, selectedRepo, branch]);

  const fs = compact ? 10 : 11;
  const pd = compact ? '5px 8px' : '6px 10px';
  const sel = { padding: pd, borderRadius: 8, fontSize: fs, border: '1px solid var(--panel-border-2)', background: 'var(--panel)', color: 'var(--ink-78)', width: '100%' };

  if (loading) return <div style={{ fontSize: fs, color: 'var(--ink-30)', padding: '4px 0' }}>Loading repos...</div>;
  if (!hasAzure && !hasGithub) return <div style={{ fontSize: fs, color: 'var(--ink-25)', padding: '4px 0' }}>No integrations configured</div>;

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {/* Provider toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        {hasAzure && (
          <button type="button" onClick={() => { setProvider('azure'); setSelectedRepo(''); setSelectedProject(''); }}
            style={{ padding: '3px 8px', borderRadius: 6, fontSize: fs, fontWeight: 700, cursor: 'pointer',
              border: provider === 'azure' ? '1px solid rgba(56,189,248,0.5)' : '1px solid var(--panel-border-2)',
              background: provider === 'azure' ? 'rgba(56,189,248,0.12)' : 'transparent',
              color: provider === 'azure' ? '#7dd3fc' : 'var(--ink-45)' }}>
            Azure DevOps
          </button>
        )}
        {hasGithub && (
          <button type="button" onClick={() => { setProvider('github'); setSelectedRepo(''); }}
            style={{ padding: '3px 8px', borderRadius: 6, fontSize: fs, fontWeight: 700, cursor: 'pointer',
              border: provider === 'github' ? `1px solid ${accent}60` : '1px solid var(--panel-border-2)',
              background: provider === 'github' ? `${accent}15` : 'transparent',
              color: provider === 'github' ? accent : 'var(--ink-45)' }}>
            GitHub
          </button>
        )}
      </div>

      {/* Azure: Project → Repo */}
      {provider === 'azure' && (
        <>
          <select value={selectedProject} onChange={(e) => { setSelectedProject(e.target.value); setSelectedRepo(''); }}
            style={sel}>
            <option value=''>Select project...</option>
            {azureProjects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          {selectedProject && (
            <select value={selectedRepo} onChange={(e) => { setSelectedRepo(e.target.value); setBranch('main'); }}
              style={sel}>
              <option value=''>Select repo...</option>
              {azureRepos.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          )}
        </>
      )}

      {/* GitHub: Repo */}
      {provider === 'github' && (
        <select value={selectedRepo} onChange={(e) => {
          setSelectedRepo(e.target.value);
          const gh = githubRepos.find((r) => r.name === e.target.value);
          setBranch(gh?.default_branch || 'main');
        }} style={sel}>
          <option value=''>Select repo...</option>
          {githubRepos.map((r) => (
            <option key={r.id} value={r.name}>{r.private ? '🔒 ' : ''}{r.name}</option>
          ))}
        </select>
      )}

      {/* Branch */}
      {selectedRepo && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: fs, color: 'var(--ink-35)', fontWeight: 600, flexShrink: 0 }}>Branch</span>
          <input value={branch} onChange={(e) => setBranch(e.target.value)}
            style={{ flex: 1, padding: compact ? '4px 6px' : '5px 8px', borderRadius: 6, fontSize: fs,
              border: '1px solid var(--panel-border-2)', background: 'var(--panel)', color: 'var(--ink-78)', outline: 'none' }} />
        </div>
      )}
    </div>
  );
}
