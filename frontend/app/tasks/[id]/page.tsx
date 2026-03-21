'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';

type TaskDetail = {
  id: number;
  title: string;
  description: string;
  source: string;
  status: string;
  pr_url?: string | null;
  created_at: string;
};

type TaskLog = {
  stage: string;
  message: string;
  created_at: string;
};

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = params.id;
  const liveStripRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'errors' | 'code'>('all');

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [error, setError] = useState('');

  async function loadData() {
    try {
      const [taskData, logsData] = await Promise.all([
        apiFetch<TaskDetail>('/tasks/' + taskId),
        apiFetch<TaskLog[]>('/tasks/' + taskId + '/logs'),
      ]);
      setTask(taskData);
      setLogs(logsData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    }
  }

  useEffect(() => {
    if (!taskId) return;
    void loadData();
    const interval = setInterval(() => void loadData(), 5000);
    return () => clearInterval(interval);
  }, [taskId]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!liveStripRef.current) return;
    liveStripRef.current.scrollTo({ left: liveStripRef.current.scrollWidth, behavior: 'smooth' });
  }, [logs]);

  const latestLogs = useMemo(() => logs.slice(-8), [logs]);
  const filteredLogs = useMemo(() => {
    if (logFilter === 'errors') {
      return logs.filter((item) => item.stage === 'failed' || /error|failed|timeout/i.test(item.message));
    }
    if (logFilter === 'code') {
      return logs.filter((item) => item.stage === 'code_preview' || item.stage === 'code_ready');
    }
    return logs;
  }, [logs, logFilter]);
  const liveFilteredLogs = useMemo(() => filteredLogs.slice(-8), [filteredLogs]);
  const logHistory = useMemo(() => [...filteredLogs].reverse(), [filteredLogs]);
  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of logs) counts[item.stage] = (counts[item.stage] || 0) + 1;
    return counts;
  }, [logs]);

  const stageColor = (stage: string) => {
    const map: Record<string, string> = {
      running: '#38bdf8',
      agent: '#5eead4',
      fetch_context: '#5eead4',
      analyze: '#f59e0b',
      generate_code: '#a78bfa',
      review_code: '#38bdf8',
      finalize: '#22c55e',
      code_ready: '#60a5fa',
      code_preview: '#f97316',
      local_exec: '#c084fc',
      pr: '#f59e0b',
      run_metrics: '#22c55e',
      completed: '#22c55e',
      failed: '#f87171',
    };
    return map[stage] ?? '#94a3b8';
  };

  return (
    <div className='container' style={{ paddingTop: 96, paddingBottom: 20, maxWidth: 1780 }}>
      <section
        style={{
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
          padding: '10px 12px',
          marginBottom: 12,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, minmax(0,1fr))',
          gap: 8,
        }}
      >
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Status</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{task?.status ?? '—'}</div>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Source</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700, textTransform: 'capitalize' }}>{task?.source ?? '—'}</div>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Total Logs</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{logs.length}</div>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Agent Events</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{statusCounts.agent || 0}</div>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Last Stage</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{latestLog?.stage ?? '—'}</div>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Last Update</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{latestLog ? new Date(latestLog.created_at).toLocaleTimeString() : '—'}</div>
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '320px minmax(900px, 1fr)',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <section
          className='card'
          style={{
            position: isMobile ? 'static' : 'sticky',
            top: 92,
            maxHeight: isMobile ? 'none' : 'calc(100vh - 120px)',
            overflowY: 'auto',
            borderRadius: 16,
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 18, lineHeight: 1.35 }}>{task?.title ?? 'Task'}</h1>
          {task ? (
            <>
              <p
                style={{
                  marginTop: 0,
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: 13,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {task.description}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <StatusBadge status={task.status} />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textTransform: 'capitalize' }}>Source: {task.source}</span>
              </div>
              <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Created: {new Date(task.created_at).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Total Logs: {logs.length}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  Last Update: {latestLog ? new Date(latestLog.created_at).toLocaleString() : '—'}
                </div>
              </div>
              {task.pr_url ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={task.pr_url} target='_blank' rel='noreferrer' className='button button-outline'>
                    Open Pull Request
                  </a>
                  <button className='button button-outline' onClick={() => navigator.clipboard.writeText(task.pr_url ?? '')}>
                    Copy PR Link
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {error ? <p style={{ color: '#f87171', marginBottom: 0 }}>{error}</p> : null}
        </section>

        <section
          style={{
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            overflow: 'hidden',
              minHeight: isMobile ? 560 : 'calc(100vh - 120px)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
            }}
          >
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>Live Logs</h3>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {latestLog ? `${latestLog.stage} • ${new Date(latestLog.created_at).toLocaleTimeString()}` : 'Auto refresh: 5s'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'errors', label: 'Errors' },
                { key: 'code', label: 'Code Preview' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setLogFilter(f.key as 'all' | 'errors' | 'code')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: logFilter === f.key ? '1px solid rgba(94,234,212,0.55)' : '1px solid rgba(255,255,255,0.15)',
                    background: logFilter === f.key ? 'rgba(94,234,212,0.12)' : 'transparent',
                    color: logFilter === f.key ? '#5eead4' : 'rgba(255,255,255,0.6)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div
              ref={liveStripRef}
              style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 6,
                scrollbarWidth: 'thin',
              }}
            >
              {liveFilteredLogs.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No live logs yet.</div>
              ) : (
                liveFilteredLogs.map((log, idx) => {
                  const color = stageColor(log.stage);
                  return (
                    <div
                      key={`${log.created_at}-${idx}`}
                      style={{
                        minWidth: isMobile ? 230 : 300,
                        maxWidth: 360,
                        borderRadius: 10,
                        border: `1px solid ${color}55`,
                        background: `${color}12`,
                        padding: '8px 9px',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                        {log.stage}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.78)',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: log.stage === 'code_preview' ? 8 : 3,
                          WebkitBoxOrient: 'vertical',
                          minHeight: log.stage === 'code_preview' ? 110 : 50,
                          whiteSpace: log.stage === 'code_preview' ? 'pre-wrap' : 'normal',
                          fontFamily: log.stage === 'code_preview' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
                        }}
                      >
                        {log.message}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{new Date(log.created_at).toLocaleString()}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: 10 }}>
            {logHistory.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, margin: 0 }}>No logs yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {logHistory.map((log, idx) => {
                  const color = stageColor(log.stage);
                  return (
                    <div
                      key={`${log.created_at}-${idx}-history`}
                      style={{
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.015)',
                        padding: '9px 10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{log.stage}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.75)',
                          lineHeight: 1.45,
                          whiteSpace: log.stage === 'code_preview' ? 'pre-wrap' : 'normal',
                          fontFamily: log.stage === 'code_preview' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
                          overflowX: log.stage === 'code_preview' ? 'auto' : 'visible',
                        }}
                      >
                        {log.message}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
