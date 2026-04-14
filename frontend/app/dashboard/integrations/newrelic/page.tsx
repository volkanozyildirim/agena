'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

interface NREntity {
  guid: string;
  name: string;
  entity_type: string;
  domain: string;
  account_id: number;
  reporting: boolean;
}

interface NRErrorGroup {
  error_class: string;
  error_message: string;
  occurrences: number;
  last_seen: string | null;
  fingerprint: string;
}

interface NRMapping {
  id: number;
  entity_guid: string;
  entity_name: string;
  entity_type: string;
  account_id: number;
  repo_mapping_id: number | null;
  repo_display_name: string | null;
  flow_id: string | null;
  auto_import: boolean;
  import_interval_minutes: number;
  last_import_at: string | null;
  is_active: boolean;
}

interface RepoMapping {
  id: number;
  provider: string;
  owner: string;
  repo_name: string;
}

export default function NewRelicPage() {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entities, setEntities] = useState<NREntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [selectedGuid, setSelectedGuid] = useState('');
  const [errors, setErrors] = useState<NRErrorGroup[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [selectedEntityName, setSelectedEntityName] = useState('');

  const [mappings, setMappings] = useState<NRMapping[]>([]);
  const [repos, setRepos] = useState<RepoMapping[]>([]);

  useEffect(() => {
    void loadMappings();
    void loadRepos();
  }, []);

  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [msg]);

  async function loadMappings() {
    try {
      const data = await apiFetch<NRMapping[]>('/newrelic/mappings');
      setMappings(data);
    } catch { /* ignore if not configured */ }
  }

  async function loadRepos() {
    try {
      const data = await apiFetch<RepoMapping[]>('/repo-mappings');
      setRepos(data);
    } catch { /* ignore */ }
  }

  async function searchEntities() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      if (entityType) params.set('entity_type', entityType);
      const data = await apiFetch<NREntity[]>(`/newrelic/entities?${params}`);
      setEntities(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch entities');
    } finally {
      setLoading(false);
    }
  }

  async function fetchErrors(guid: string, entityName: string) {
    setSelectedGuid(guid);
    setSelectedEntityName(entityName);
    setErrorsLoading(true);
    try {
      const data = await apiFetch<{ errors: NRErrorGroup[] }>(`/newrelic/entities/${guid}/errors`);
      setErrors(data.errors || []);
    } catch {
      setErrors([]);
    } finally {
      setErrorsLoading(false);
    }
  }

  async function addMapping(entity: NREntity) {
    try {
      await apiFetch('/newrelic/mappings', {
        method: 'POST',
        body: JSON.stringify({
          entity_guid: entity.guid,
          entity_name: entity.name,
          entity_type: entity.entity_type,
          account_id: entity.account_id,
        }),
      });
      setMsg(`"${entity.name}" mapped — select a repo from the dropdown`);
      await loadMappings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add mapping');
    }
  }

  async function updateMapping(id: number, updates: Record<string, unknown>) {
    try {
      await apiFetch(`/newrelic/mappings/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
      await loadMappings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update mapping');
    }
  }

  async function deleteMapping(id: number) {
    try {
      await apiFetch(`/newrelic/mappings/${id}`, { method: 'DELETE' });
      await loadMappings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete mapping');
    }
  }

  async function importErrors(entityGuid?: string) {
    setError('');
    setMsg('');
    try {
      const body: Record<string, unknown> = {};
      if (entityGuid) body.entity_guid = entityGuid;
      const res = await apiFetch<{ imported: number; skipped: number }>('/tasks/import/newrelic', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.imported === 0 && res.skipped > 0) {
        setMsg(`No new errors to import — ${res.skipped} already imported before`);
      } else if (res.imported > 0 && res.skipped > 0) {
        setMsg(`${res.imported} new error(s) imported as tasks, ${res.skipped} skipped (already exists)`);
      } else if (res.imported > 0) {
        setMsg(`${res.imported} error(s) imported as tasks`);
      } else {
        setMsg('No errors found to import');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
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
    padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1CE783', color: '#000',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  };
  const btnSmall: React.CSSProperties = {
    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--panel-border)',
    background: 'transparent', color: 'var(--ink-58)', fontSize: 11, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
        {t('integrations.providerNewrelic')} — Entity Browser
      </h2>

      {msg && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 12, fontWeight: 600 }}>{msg}</div>}
      {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 12, fontWeight: 600 }}>{error}</div>}

      {/* Search */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('integrations.newrelicAccountIdPlaceholder').replace('Account ID', 'entity name')}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }} onKeyDown={(e) => e.key === 'Enter' && searchEntities()} />
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} style={{ ...inputStyle, width: 180 }}>
            <option value="">All Types</option>
            <option value="APPLICATION">APM Application</option>
            <option value="BROWSER_APPLICATION">Browser App</option>
            <option value="MOBILE_APPLICATION">Mobile App</option>
            <option value="HOST">Infrastructure Host</option>
            <option value="MONITOR">Synthetic Monitor</option>
          </select>
          <button onClick={() => void searchEntities()} disabled={loading} style={btnPrimary}>
            {loading ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Entity results */}
      {entities.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--ink-58)' }}>Entities ({entities.length})</h3>
          <div style={{ display: 'grid', gap: 4 }}>
            {entities.map((e) => {
              const mapping = mappings.find((m) => m.entity_guid === e.guid);
              return (
                <div key={e.guid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: selectedGuid === e.guid ? 'var(--glass)' : 'transparent', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 150, color: 'var(--ink)' }}>{e.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-35)', fontWeight: 500 }}>{e.entity_type.replace('_ENTITY', '')}</span>
                  <span style={{ fontSize: 10, color: e.reporting ? '#22c55e' : '#f87171' }}>{e.reporting ? 'Active' : 'Inactive'}</span>
                  <button onClick={() => void fetchErrors(e.guid, e.name)} style={btnSmall}>Errors</button>
                  {!mapping && <button onClick={() => void addMapping(e)} style={btnSmall}>+ Map</button>}
                  {mapping && (
                    <>
                      <select
                        value={mapping.repo_mapping_id ?? ''}
                        onChange={(ev) => void updateMapping(mapping.id, { repo_mapping_id: ev.target.value ? parseInt(ev.target.value) : null })}
                        style={{ ...inputStyle, width: 160, fontSize: 11, padding: '4px 8px' }}
                      >
                        <option value="">-- Repo --</option>
                        {repos.map((r) => (
                          <option key={r.id} value={r.id}>{r.owner}/{r.repo_name}</option>
                        ))}
                      </select>
                      <button onClick={() => void importErrors(mapping.entity_guid)} style={btnSmall}>Import</button>
                      <button onClick={() => void deleteMapping(mapping.id)} style={{ ...btnSmall, color: '#f87171', borderColor: 'rgba(248,113,113,0.2)', fontSize: 10 }}>x</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error groups */}
      {selectedGuid && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-58)' }}>Errors — {selectedEntityName}</h3>
            <button onClick={() => void importErrors(selectedGuid)} style={btnPrimary}>Import as Tasks</button>
          </div>
          {errorsLoading ? (
            <div style={{ fontSize: 12, color: 'var(--ink-35)', padding: 12 }}>Loading...</div>
          ) : errors.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-35)', padding: 12 }}>No errors found</div>
          ) : (
            <div style={{ display: 'grid', gap: 4 }}>
              {errors.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--glass)', fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: '#f87171', minWidth: 40, textAlign: 'right' }}>{e.occurrences}x</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{e.error_class}</span>
                  <span style={{ color: 'var(--ink-50)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.error_message}</span>
                  {e.last_seen && <span style={{ color: 'var(--ink-25)', fontSize: 10, flexShrink: 0 }}>{new Date(Number(e.last_seen)).toLocaleString()}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mappings */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-58)' }}>Entity Mappings</h3>
          <button onClick={() => void importErrors()} style={btnPrimary}>Import All</button>
        </div>
        {mappings.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ink-35)', padding: 12 }}>No entity mappings yet. Search entities above and click "+ Map".</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {mappings.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--glass)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.entity_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-35)' }}>{m.entity_type} • {m.repo_display_name || 'No repo'}</div>
                </div>
                <select
                  value={m.repo_mapping_id ?? ''}
                  onChange={(e) => void updateMapping(m.id, { repo_mapping_id: e.target.value ? parseInt(e.target.value) : null })}
                  style={{ ...inputStyle, width: 160, fontSize: 11 }}
                >
                  <option value="">No repo</option>
                  {repos.map((r) => (
                    <option key={r.id} value={r.id}>{r.owner}/{r.repo_name}</option>
                  ))}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, color: 'var(--ink-50)' }}>
                  <input type="checkbox" checked={m.auto_import} onChange={(e) => void updateMapping(m.id, { auto_import: e.target.checked })} />
                  Auto
                </label>
                <button onClick={() => void importErrors(m.entity_guid)} style={btnSmall}>Import</button>
                <button onClick={() => void deleteMapping(m.id)} style={{ ...btnSmall, color: '#f87171', borderColor: 'rgba(248,113,113,0.2)' }}>x</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
