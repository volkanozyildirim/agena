'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

const box: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--panel-border-2)',
  background: 'var(--panel)',
  padding: 24,
};

interface DoraSummary {
  lead_time_hours: number | null;
  deploy_frequency: number | null;
  change_failure_rate: number | null;
  mttr_hours: number | null;
  daily: Array<{
    date: string;
    completed: number;
    failed: number;
    lead_time_hours: number | null;
    mttr_hours: number | null;
  }>;
}

function classifyMetric(
  metric: 'leadTime' | 'deployFreq' | 'changeFailRate' | 'mttr',
  value: number | null,
): 'elite' | 'high' | 'medium' | 'low' {
  if (value === null) return 'low';
  switch (metric) {
    case 'leadTime':
      if (value < 24) return 'elite';
      if (value < 168) return 'high';
      if (value < 720) return 'medium';
      return 'low';
    case 'deployFreq':
      if (value >= 1) return 'elite';
      if (value >= 1 / 7) return 'high';
      if (value >= 1 / 30) return 'medium';
      return 'low';
    case 'changeFailRate':
      if (value <= 5) return 'elite';
      if (value <= 10) return 'high';
      if (value <= 15) return 'medium';
      return 'low';
    case 'mttr':
      if (value < 1) return 'elite';
      if (value < 24) return 'high';
      if (value < 168) return 'medium';
      return 'low';
  }
}

const badgeColors: Record<string, { bg: string; border: string; text: string }> = {
  elite: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#22c55e' },
  high: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#3b82f6' },
  medium: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', text: '#eab308' },
  low: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#ef4444' },
};

function Sparkline({ data, color, width = 120, height = 36 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ width, height, opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--muted)' }}>--</div>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const areaPoints = [`0,${height}`, ...points, `${width},${height}`].join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polygon points={areaPoints} fill={color} opacity={0.15} />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatValue(metric: string, value: number | null): string {
  if (value === null) return '\u2014';
  switch (metric) {
    case 'leadTime': return value < 1 ? `${Math.round(value * 60)}m` : `${value.toFixed(1)}h`;
    case 'deployFreq': return value >= 1 ? `${value.toFixed(1)}/d` : `${(value * 7).toFixed(1)}/w`;
    case 'changeFailRate': return `${value.toFixed(1)}%`;
    case 'mttr': return value < 1 ? `${Math.round(value * 60)}m` : `${value.toFixed(1)}h`;
    default: return String(value);
  }
}

export default function DoraOverviewPage() {
  const { t } = useLocale();
  const [data, setData] = useState<DoraSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch<DoraSummary>('/analytics/dora');
        if (active) setData(res);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load DORA metrics');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const metrics = [
    {
      key: 'leadTime' as const,
      label: t('dora.leadTime'),
      desc: t('dora.leadTimeDesc'),
      value: data?.lead_time_hours ?? null,
      sparkData: data?.daily.map((d) => d.lead_time_hours ?? 0) ?? [],
      color: '#3b82f6',
    },
    {
      key: 'deployFreq' as const,
      label: t('dora.deployFreq'),
      desc: t('dora.deployFreqDesc'),
      value: data?.deploy_frequency ?? null,
      sparkData: data?.daily.map((d) => d.completed) ?? [],
      color: '#22c55e',
    },
    {
      key: 'changeFailRate' as const,
      label: t('dora.changeFailRate'),
      desc: t('dora.changeFailRateDesc'),
      value: data?.change_failure_rate ?? null,
      sparkData: data?.daily.map((d) => {
        const total = d.completed + d.failed;
        return total > 0 ? (d.failed / total) * 100 : 0;
      }) ?? [],
      color: '#ef4444',
    },
    {
      key: 'mttr' as const,
      label: t('dora.mttr'),
      desc: t('dora.mttrDesc'),
      value: data?.mttr_hours ?? null,
      sparkData: data?.daily.map((d) => d.mttr_hours ?? 0) ?? [],
      color: '#f59e0b',
    },
  ];

  const benchmarkRows = [
    { label: t('dora.elite'), color: '#22c55e', lt: '< 1 day', df: 'On-demand', cfr: '< 5%', mttr: '< 1 hour' },
    { label: t('dora.high'), color: '#3b82f6', lt: '1 day - 1 week', df: 'Daily to weekly', cfr: '5-10%', mttr: '< 1 day' },
    { label: t('dora.medium'), color: '#eab308', lt: '1 week - 1 month', df: 'Weekly to monthly', cfr: '10-15%', mttr: '< 1 week' },
    { label: t('dora.low'), color: '#ef4444', lt: '> 1 month', df: '< monthly', cfr: '> 15%', mttr: '> 1 week' },
  ];

  const quickLinks = [
    { href: '/dashboard/dora/project', icon: '📋', label: t('dora.projectTitle'), desc: t('dora.projectDesc') },
    { href: '/dashboard/dora/development', icon: '⚡', label: t('dora.devTitle'), desc: t('dora.devDesc') },
    { href: '/dashboard/dora/quality', icon: '🛡', label: t('dora.qualityTitle'), desc: t('dora.qualityDesc') },
    { href: '/dashboard/dora/bugs', icon: '🐛', label: t('dora.bugsTitle'), desc: t('dora.bugsDesc') },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>{t('dora.title')}</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>{t('dora.subtitle')}</p>
        <span style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: 'var(--muted)', background: 'var(--glass)', border: '1px solid var(--panel-border)', borderRadius: 999, padding: '3px 10px' }}>
          {t('dora.last30')}
        </span>
      </div>

      {error && (
        <div style={{ ...box, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {/* 4 DORA metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 40 }}>
        {metrics.map((m) => {
          const level = classifyMetric(m.key, m.value);
          const badge = badgeColors[level];
          return (
            <div key={m.key} style={{ ...box, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}>
              {loading && (
                <div style={{ position: 'absolute', inset: 0, background: 'var(--panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>...</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{m.desc}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                  padding: '3px 8px', borderRadius: 999,
                  background: badge.bg, border: `1px solid ${badge.border}`, color: badge.text,
                }}>
                  {t(`dora.${level}` as Parameters<typeof t>[0])}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>
                  {formatValue(m.key, m.value)}
                </div>
                <Sparkline data={m.sparkData} color={m.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Engineering Benchmark */}
      <div style={{ ...box, marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>{t('dora.benchmark')}</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Level</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{t('dora.leadTime')}</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{t('dora.deployFreq')}</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{t('dora.changeFailRate')}</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{t('dora.mttr')}</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkRows.map((row) => (
                <tr key={row.label} style={{ borderBottom: '1px solid var(--panel-border-2)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
                      <span style={{ fontWeight: 600, color: row.color }}>{row.label}</span>
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink)' }}>{row.lt}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink)' }}>{row.df}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink)' }}>{row.cfr}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink)' }}>{row.mttr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>{t('dora.quickLinks')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} style={{
              ...box, textDecoration: 'none', padding: 20, display: 'flex', flexDirection: 'column', gap: 8,
              transition: 'border-color 0.2s, transform 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--panel-border-2)'; }}
            >
              <span style={{ fontSize: 24 }}>{link.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{link.label}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{link.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
