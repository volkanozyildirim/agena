'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchProjectAnalytics,
  type ProjectAnalyticsResponse,
} from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import BarChart from '@/components/charts/BarChart';
import LineChart from '@/components/charts/LineChart';
import RepoSelector from '@/components/RepoSelector';

const box: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--panel-border-2)',
  background: 'var(--panel)',
  padding: 24,
};

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, suffix = '%', color }: { label: string; value: number; suffix?: string; color: string }) {
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>{value.toFixed(1)}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>{suffix}</span>
      </div>
      {suffix === '%' && (
        <div style={{ height: 4, borderRadius: 2, background: 'var(--panel-border)', overflow: 'hidden', marginTop: 4 }}>
          <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
      )}
    </div>
  );
}

// ── WIP Gauge ───────────────────────────────────────────────────────────────

function WipGauge({ count, label }: { count: number; label: string }) {
  const color = count < 5 ? '#22c55e' : count < 10 ? '#eab308' : '#ef4444';
  const levelLabel = count < 5 ? 'Low' : count < 10 ? 'Medium' : 'High';
  const angle = Math.min(count / 15, 1) * 180;

  const r = 60;
  const cx = 70;
  const cy = 70;
  const startAngle = Math.PI;
  const endAngle = Math.PI - (angle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{label}</div>
      <svg width={140} height={80} viewBox="0 0 140 80" style={{ display: 'block' }}>
        {/* background arc */}
        <path
          d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
          fill="none"
          stroke="var(--panel-border)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* filled arc */}
        {angle > 0 && (
          <path
            d={`M ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2}`}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={26} fontWeight={800} fill={color}>{count}</text>
      </svg>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 1,
        padding: '3px 10px',
        borderRadius: 999,
        background: color === '#22c55e' ? 'rgba(34,197,94,0.15)' : color === '#eab308' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
        border: `1px solid ${color === '#22c55e' ? 'rgba(34,197,94,0.4)' : color === '#eab308' ? 'rgba(234,179,8,0.4)' : 'rgba(239,68,68,0.4)'}`,
        color,
      }}>
        {levelLabel}
      </span>
    </div>
  );
}

// ── Dual Line Chart (Cycle & Lead Time) ─────────────────────────────────────

function DualLineChart({
  data,
  color1 = '#38bdf8',
  color2 = '#a78bfa',
  label1,
  label2,
  width = 480,
  height = 200,
}: {
  data: Array<{ label: string; v1: number; v2: number }>;
  color1?: string;
  color2?: string;
  label1: string;
  label2: string;
  width?: number;
  height?: number;
}) {
  if (data.length === 0) return null;

  const pad = { top: 12, right: 8, bottom: 32, left: 8 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const maxVal = Math.max(...data.map((d) => Math.max(d.v1, d.v2)), 1);

  const toPoints = (vals: number[]) =>
    vals.map((v, i) => {
      const x = pad.left + (vals.length === 1 ? chartW / 2 : (i / (vals.length - 1)) * chartW);
      const y = pad.top + chartH - (v / maxVal) * chartH;
      return { x, y };
    });

  const pts1 = toPoints(data.map((d) => d.v1));
  const pts2 = toPoints(data.map((d) => d.v2));
  const polyline = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: color1, display: 'inline-block' }} />
          {label1}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: color2, display: 'inline-block' }} />
          {label2}
        </span>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <polyline points={polyline(pts1)} fill="none" stroke={color1} strokeWidth={2} strokeLinejoin="round" />
        <polyline points={polyline(pts2)} fill="none" stroke={color2} strokeWidth={2} strokeLinejoin="round" />
        {pts1.map((p, i) => (
          <circle key={`a${i}`} cx={p.x} cy={p.y} r={3} fill={color1}>
            <title>{`${data[i].label}: ${data[i].v1.toFixed(1)}h`}</title>
          </circle>
        ))}
        {pts2.map((p, i) => (
          <circle key={`b${i}`} cx={p.x} cy={p.y} r={3} fill={color2}>
            <title>{`${data[i].label}: ${data[i].v2.toFixed(1)}h`}</title>
          </circle>
        ))}
        {data.length <= 14 &&
          pts1.map((p, i) => (
            <text key={i} x={p.x} y={height - 6} textAnchor="middle" fontSize={9} fill="var(--ink-35)" fontFamily="monospace">
              {data[i].label.length > 5 ? data[i].label.slice(-5) : data[i].label}
            </text>
          ))}
        <line x1={pad.left} y1={pad.top + chartH} x2={pad.left + chartW} y2={pad.top + chartH} stroke="var(--panel-border)" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DoraProjectPage() {
  const { t } = useLocale();
  const [data, setData] = useState<ProjectAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [repoId, setRepoId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await fetchProjectAnalytics(days, repoId);
        if (active) setData(res);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load project analytics');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [days, repoId]);

  const periodOptions = [7, 14, 30, 60, 90];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Link href="/dashboard/dora" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>DORA</Link>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>/</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>{t('dora.project.pageTitle')}</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>{t('dora.projectDesc')}</p>
          <RepoSelector value={repoId} onSelect={setRepoId} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {periodOptions.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: '1px solid var(--panel-border)',
                background: days === d ? 'var(--accent)' : 'var(--glass)',
                color: days === d ? '#fff' : 'var(--ink)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ ...box, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 13 }}>
          ...
        </div>
      )}

      {!loading && data && (
        <>
          {/* 4 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
            <KpiCard label={t('dora.project.predictability')} value={data.kpi.predictability} color="#22c55e" />
            <KpiCard label={t('dora.project.productivity')} value={data.kpi.productivity} color="#3b82f6" />
            <KpiCard label={t('dora.project.deliveryRate')} value={data.kpi.delivery_rate} color="#8b5cf6" />
            <KpiCard label={t('dora.project.planningAccuracy')} value={data.kpi.planning_accuracy} color="#f59e0b" />
          </div>

          {/* Totals summary row */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dora.project.planned')}: <strong style={{ color: 'var(--ink)' }}>{data.totals.planned}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dora.project.completed')}: <strong style={{ color: 'var(--ink)' }}>{data.totals.completed}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dora.project.failed')}: <strong style={{ color: 'var(--ink)' }}>{data.totals.failed}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dora.project.cycleTime')}: <strong style={{ color: 'var(--ink)' }}>{data.avg_cycle_time_hours} {t('dora.project.hours')}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dora.project.leadTime')}: <strong style={{ color: 'var(--ink)' }}>{data.avg_lead_time_hours} {t('dora.project.hours')}</strong></span>
            </div>
          </div>

          {/* Charts row 1: Velocity + WIP */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16, marginBottom: 24 }}>
            <div style={box}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>{t('dora.project.velocity')}</h2>
              {data.weekly_trend.length > 0 ? (
                <BarChart
                  data={data.weekly_trend.slice(-8).map((w) => ({ label: w.week, value: w.completed }))}
                  barColor="#5eead4"
                />
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 12, padding: 20, textAlign: 'center' }}>{t('dora.project.noData')}</div>
              )}
            </div>
            <WipGauge count={data.wip_count} label={t('dora.project.wip')} />
          </div>

          {/* Charts row 2: Cycle & Lead Time Trend */}
          <div style={{ ...box, marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>{t('dora.project.cycleLeadTrend')}</h2>
            {data.time_trend.length > 0 ? (
              <DualLineChart
                data={data.time_trend.map((item) => ({ label: item.date, v1: item.avg_cycle_time_hours, v2: item.avg_lead_time_hours }))}
                color1="#38bdf8"
                color2="#a78bfa"
                label1={t('dora.project.cycleTime')}
                label2={t('dora.project.leadTime')}
              />
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12, padding: 20, textAlign: 'center' }}>{t('dora.project.noData')}</div>
            )}
          </div>

          {/* Charts row 3: Throughput */}
          <div style={{ ...box, marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>{t('dora.project.throughput')}</h2>
            {data.throughput_trend.length > 0 ? (
              <LineChart
                data={data.throughput_trend.map((item) => ({ label: item.week, value: item.throughput }))}
                lineColor="#22c55e"
                fillColor="rgba(34,197,94,0.12)"
              />
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12, padding: 20, textAlign: 'center' }}>{t('dora.project.noData')}</div>
            )}
          </div>
        </>
      )}

      {!loading && !data && !error && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 13 }}>
          {t('dora.project.noData')}
        </div>
      )}
    </div>
  );
}
