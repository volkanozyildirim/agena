'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, loadPrefs } from '@/lib/api';
import { TaskItem } from '@/components/TaskTable';

const STATUS_FILTERS = ['all', 'queued', 'running', 'completed', 'failed'];

function statusColor(s: string) {
  const m: Record<string, string> = { queued: '#f59e0b', running: '#38bdf8', completed: '#22c55e', failed: '#f87171' };
  return m[s] ?? '#6b7280';
}

function fmtDuration(sec?: number | null): string {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

export default function DashboardTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [queueItems, setQueueItems] = useState<{
    task_id: number;
    title: string;
    status: string;
    position: number;
    create_pr: boolean;
    source: string;
    created_at: string;
  }[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [defaultCreatePr, setDefaultCreatePr] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [storyContext, setStoryContext] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [edgeCases, setEdgeCases] = useState('');
  const [maxTokens, setMaxTokens] = useState('');
  const [maxCostUsd, setMaxCostUsd] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      qs.set('status', filter);
      qs.set('q', search);
      qs.set('page', String(page));
      qs.set('page_size', String(pageSize));
      if (dateFrom) qs.set('created_from', dateFrom);
      if (dateTo) qs.set('created_to', dateTo);

      const [data, queueData] = await Promise.all([
        apiFetch<{ items: TaskItem[]; total: number; page: number; page_size: number }>(`/tasks/search?${qs.toString()}`),
        apiFetch<{
          task_id: number;
          title: string;
          status: string;
          position: number;
          create_pr: boolean;
          source: string;
          created_at: string;
        }[]>('/tasks/queue'),
      ]);
      setTasks(data.items);
      setTotal(data.total);
      setQueueItems(queueData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }, [dateFrom, dateTo, filter, page, search]);

  useEffect(() => {
    loadPrefs().then((prefs) => {
      const raw = (prefs.profile_settings || {}) as Record<string, unknown>;
      if (typeof raw.default_create_pr === 'boolean') setDefaultCreatePr(raw.default_create_pr);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 5000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          story_context: storyContext || undefined,
          acceptance_criteria: acceptanceCriteria || undefined,
          edge_cases: edgeCases || undefined,
          max_tokens: maxTokens ? Number(maxTokens) : undefined,
          max_cost_usd: maxCostUsd ? Number(maxCostUsd) : undefined,
        }),
      });
      setTitle('');
      setDescription('');
      setStoryContext('');
      setAcceptanceCriteria('');
      setEdgeCases('');
      setMaxTokens('');
      setMaxCostUsd('');
      setShowCreate(false);
      setMsg('Task created'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Create failed'); }
  }

  async function onAssign(id: number) {
    try {
      await apiFetch('/tasks/' + id + '/assign', { method: 'POST', body: JSON.stringify({ create_pr: defaultCreatePr }) });
      setMsg('Assigned to AI'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Assign failed'); }
  }

  async function onRemoveFromQueue(id: number) {
    try {
      await apiFetch('/tasks/' + id + '/cancel', { method: 'POST' });
      setMsg('Removed from queue');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    }
  }

  const currentPage = Math.min(page, totalPages);

  function applyRange(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
    setPage(1);
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className='section-label'>Tasks</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'rgba(255,255,255,0.95)', marginTop: 8, marginBottom: 4 }}>
            Agent Task Feed
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>{total.toLocaleString()} total tasks</p>
        </div>
        <button
          className='button button-primary'
          onClick={() => setShowCreate(!showCreate)}
          style={{ alignSelf: 'flex-start' }}
        >
          + New Task
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{
          borderRadius: 20, border: '1px solid rgba(13,148,136,0.3)',
          background: 'rgba(13,148,136,0.06)', padding: 24,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(13,148,136,0.6), transparent)' }} />
          <h3 style={{ color: 'rgba(255,255,255,0.9)', marginTop: 0, marginBottom: 16 }}>Create New Task</h3>
          <form onSubmit={onCreate} style={{ display: 'grid', gap: 12 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Task title' required />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Description' rows={3} required />
            <textarea
              value={storyContext}
              onChange={(e) => setStoryContext(e.target.value)}
              placeholder='Story context (business intent, users, expected value)'
              rows={2}
            />
            <textarea
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder='Acceptance criteria'
              rows={2}
            />
            <textarea
              value={edgeCases}
              onChange={(e) => setEdgeCases(e.target.value)}
              placeholder='Edge cases / constraints'
              rows={2}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                type='number'
                min='1'
                step='1'
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                placeholder='Max tokens (guardrail)'
              />
              <input
                type='number'
                min='0'
                step='0.0001'
                value={maxCostUsd}
                onChange={(e) => setMaxCostUsd(e.target.value)}
                placeholder='Max cost USD (guardrail)'
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type='submit' className='button button-primary'>Create Task</button>
              <button type='button' className='button button-outline' onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.02)' }}>
        <input
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
          placeholder='Search tasks...'
          style={{ width: 220, padding: '8px 14px', fontSize: 13 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setFilter(s); setPage(1); }}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                border: filter === s ? `1px solid ${s === 'all' ? '#5eead4' : statusColor(s)}` : '1px solid rgba(255,255,255,0.1)',
                background: filter === s ? (s === 'all' ? 'rgba(94,234,212,0.12)' : `${statusColor(s)}18`) : 'transparent',
                color: filter === s ? (s === 'all' ? '#5eead4' : statusColor(s)) : 'rgba(255,255,255,0.4)',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 30].map((d) => (
            <button
              key={d}
              className='button button-outline'
              onClick={() => applyRange(d)}
              style={{ padding: '5px 8px', fontSize: 11 }}
            >
              Last {d}d
            </button>
          ))}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>From</span>
        <input
          type='date'
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            style={{ padding: '4px 6px', fontSize: 11, minWidth: 130 }}
        />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>To</span>
        <input
          type='date'
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            style={{ padding: '4px 6px', fontSize: 11, minWidth: 130 }}
        />
        </div>
        <button
          className='button button-outline'
          onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); setFilter('all'); setPage(1); }}
          style={{ padding: '6px 10px', fontSize: 11 }}
        >
          Reset
        </button>
      </div>

      {/* Notification */}
      {(msg || error) && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, fontSize: 13,
          background: error ? 'rgba(248,113,113,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${error ? 'rgba(248,113,113,0.3)' : 'rgba(34,197,94,0.3)'}`,
          color: error ? '#f87171' : '#22c55e',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {error || msg}
          <button onClick={() => { setError(''); setMsg(''); }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Queue panel */}
      <div style={{ borderRadius: 16, border: '1px solid rgba(245,158,11,0.28)', background: 'rgba(245,158,11,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(245,158,11,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#f59e0b' }}>
            Queue
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{queueItems.length} waiting</div>
        </div>
        {queueItems.length === 0 ? (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>No queued tasks.</div>
        ) : (
          queueItems.map((q) => (
            <div key={q.task_id} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) auto auto', gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 800 }}>#{q.position}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.title}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                  Task #{q.task_id} • {q.source}
                </div>
              </div>
              <Link href={`/tasks/${q.task_id}`} className='button button-outline' style={{ padding: '5px 9px', fontSize: 12, whiteSpace: 'nowrap' }}>
                Open
              </Link>
              <button className='button button-outline' onClick={() => void onRemoveFromQueue(q.task_id)} style={{ padding: '5px 9px', fontSize: 12, whiteSpace: 'nowrap', borderColor: 'rgba(248,113,113,0.35)', color: '#f87171' }}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* Task list */}
      <div style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'minmax(0,1.45fr) 80px 98px 88px 88px 70px 92px 78px minmax(180px,0.85fr)', gap: 10 }}>
          {['Task', 'Source', 'Status', 'Run', 'Queue', 'Retry', 'Tokens', 'PR', 'Actions'].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</span>
          ))}
        </div>

        {tasks.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
            No tasks found.
          </div>
        ) : (
          tasks.map((t) => (
            <div key={t.id} style={{
              padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
              display: 'grid', gridTemplateColumns: 'minmax(0,1.45fr) 80px 98px 88px 88px 70px 92px 78px minmax(180px,0.85fr)', gap: 10, alignItems: 'center',
              transition: 'background 0.2s',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 2 }}>{t.title}</div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.3)',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.35,
                  maxHeight: 32,
                }}>{t.description}</div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                textTransform: 'capitalize', width: 'fit-content',
              }}>{t.source}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: `${statusColor(t.status)}18`,
                border: `1px solid ${statusColor(t.status)}40`,
                color: statusColor(t.status), width: 'fit-content', textTransform: 'capitalize',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor(t.status), animation: t.status === 'running' ? 'pulse-brand 1.5s infinite' : 'none' }} />
                {t.status}
              </span>
              <div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{fmtDuration(t.run_duration_sec ?? t.duration_sec)}</span>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{fmtDuration(t.queue_wait_sec)}</span>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{t.retry_count ?? 0}</span>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                  {t.total_tokens !== null && t.total_tokens !== undefined ? t.total_tokens.toLocaleString() : '—'}
                </span>
              </div>
              <div>
                {t.pr_url ? (
                  <a href={t.pr_url} target='_blank' rel='noreferrer' style={{ fontSize: 12, color: '#5eead4', textDecoration: 'none' }}>View PR ↗</a>
                ) : (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>—</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  className='button button-primary'
                  onClick={() => void onAssign(t.id)}
                  style={{ padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  Assign AI
                </button>
                <Link href={`/tasks/${t.id}`} className='button button-outline' style={{ padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>
                  Details
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          Showing {(currentPage - 1) * pageSize + (tasks.length > 0 ? 1 : 0)}-{(currentPage - 1) * pageSize + tasks.length} of {total}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className='button button-outline'
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={{ padding: '6px 10px', fontSize: 12, opacity: currentPage <= 1 ? 0.5 : 1 }}
          >
            Prev
          </button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Page {currentPage} / {totalPages}</span>
          <button
            className='button button-outline'
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            style={{ padding: '6px 10px', fontSize: 12, opacity: currentPage >= totalPages ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
