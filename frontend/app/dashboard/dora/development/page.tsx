'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchDoraDevelopment, type DoraDevelopmentResponse } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import RepoSelector from '@/components/RepoSelector';

const box: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--panel-border-2)',
  background: 'var(--panel)',
  padding: 24,
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function DoraDevelopmentPage() {
  const { t } = useLocale();
  const [data, setData] = useState<DoraDevelopmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [repoId, setRepoId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await fetchDoraDevelopment(30, repoId);
        if (active) setData(res);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [repoId]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div>
        <Link href="/dashboard/dora" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
          DORA &rsaquo;
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', margin: '8px 0 0' }}>
          {t('dora.dev.title')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>
          {t('dora.dev.subtitle')}
        </p>
        <RepoSelector value={repoId} onSelect={setRepoId} />
        <span style={{
          display: 'inline-block', marginTop: 8, fontSize: 11,
          color: 'var(--muted)', background: 'var(--glass)',
          border: '1px solid var(--panel-border)', borderRadius: 999, padding: '3px 10px',
        }}>
          {t('dora.dev.last30days')}
        </span>
      </div>

      {error && (
        <div style={{ ...box, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ ...box, textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 40 }}>
          Loading...
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <KpiCard
              label={t('dora.dev.codingEfficiency')}
              value={`${data.coding_efficiency}%`}
              color={data.coding_efficiency >= 80 ? '#22c55e' : data.coding_efficiency >= 60 ? '#eab308' : '#ef4444'}
            />
            <KpiCard
              label={t('dora.dev.reworkRate')}
              value={`${data.rework_rate}%`}
              color={data.rework_rate <= 10 ? '#22c55e' : data.rework_rate <= 25 ? '#eab308' : '#ef4444'}
            />
            <KpiCard
              label={t('dora.dev.avgCostPerTask')}
              value={`$${data.avg_cost_per_task.toFixed(4)}`}
              color="#3b82f6"
            />
            <KpiCard
              label={t('dora.dev.avgCompletionTime')}
              value={`${data.avg_completion_minutes} ${t('dora.dev.minutes')}`}
              color="#8b5cf6"
            />
            <KpiCard
              label={t('dora.dev.avgTokensPerTask')}
              value={data.avg_tokens_per_task.toLocaleString()}
              color="#0d9488"
            />
            <KpiCard
              label={t('dora.dev.totalTasks')}
              value={`${data.completed_tasks}/${data.total_tasks}`}
              sub={`${data.failed_tasks} ${t('dora.dev.failedTasks').toLowerCase()}`}
              color="var(--ink-78)"
            />
          </div>

          {/* Agent Performance Table */}
          <div style={box}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>
              {t('dora.dev.agentPerformance')}
            </h2>
            {data.agent_performance.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dora.dev.noData')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                      <Th>{t('dora.dev.role')}</Th>
                      <Th>{t('dora.dev.tasks')}</Th>
                      <Th>{t('dora.dev.successRate')}</Th>
                      <Th>{t('dora.dev.avgDuration')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agent_performance.map((a) => (
                      <tr key={a.role} style={{ borderBottom: '1px solid var(--panel-border-2)' }}>
                        <Td><span style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{a.role}</span></Td>
                        <Td>{a.tasks}</Td>
                        <Td>
                          <span style={{ color: a.success_rate >= 80 ? '#22c55e' : a.success_rate >= 60 ? '#eab308' : '#ef4444' }}>
                            {a.success_rate}%
                          </span>
                        </Td>
                        <Td>{formatMs(a.avg_duration_ms)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Model Performance Table */}
          <div style={box}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>
              {t('dora.dev.modelPerformance')}
            </h2>
            {data.model_performance.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dora.dev.noData')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                      <Th>{t('dora.dev.model')}</Th>
                      <Th>{t('dora.dev.tasks')}</Th>
                      <Th>{t('dora.dev.tokens')}</Th>
                      <Th>{t('dora.dev.cost')}</Th>
                      <Th>{t('dora.dev.successRate')}</Th>
                      <Th>{t('dora.dev.avgDuration')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.model_performance.map((m) => (
                      <tr key={m.model} style={{ borderBottom: '1px solid var(--panel-border-2)' }}>
                        <Td><span style={{ fontFamily: 'monospace', color: '#c084fc' }}>{m.model}</span></Td>
                        <Td>{m.tasks}</Td>
                        <Td>{m.total_tokens.toLocaleString()}</Td>
                        <Td>${m.cost_usd.toFixed(4)}</Td>
                        <Td>
                          <span style={{ color: m.success_rate >= 80 ? '#22c55e' : m.success_rate >= 60 ? '#eab308' : '#ef4444' }}>
                            {m.success_rate}%
                          </span>
                        </Td>
                        <Td>{formatMs(m.avg_duration_ms)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {/* Cost per Task Trend */}
            <div style={box}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>
                {t('dora.dev.costPerTaskTrend')}
              </h2>
              {data.cost_per_task_trend.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dora.dev.noData')}</div>
              ) : (
                <LineChart
                  data={data.cost_per_task_trend.map((d) => ({
                    label: d.date,
                    value: parseFloat((d.cost_per_task * 100).toFixed(2)),
                  }))}
                  height={200}
                  lineColor="#f59e0b"
                  fillColor="rgba(245,158,11,0.12)"
                />
              )}
            </div>

            {/* Token Usage Trend */}
            <div style={box}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>
                {t('dora.dev.tokenUsageTrend')}
              </h2>
              {data.token_usage_trend.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dora.dev.noData')}</div>
              ) : (
                <BarChart
                  data={data.token_usage_trend.map((d) => ({
                    label: d.date,
                    value: d.total_tokens,
                  }))}
                  height={200}
                  barColor="#0d9488"
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{
      ...box,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', padding: '8px 12px',
      color: 'var(--muted)', fontWeight: 600,
      fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
    }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '10px 12px', color: 'var(--ink)' }}>
      {children}
    </td>
  );
}
