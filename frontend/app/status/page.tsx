'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/lib/i18n';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'degraded' | 'down' | 'checking';
  latency?: number;
  details?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.agena.dev';

export default function StatusPage() {
  const { t } = useLocale();
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'API Server', status: 'checking' },
    { name: 'Database', status: 'checking' },
    { name: 'Redis Queue', status: 'checking' },
    { name: 'Vector Memory (Qdrant)', status: 'checking' },
  ]);
  const [lastChecked, setLastChecked] = useState<string>('');

  async function checkHealth() {
    const start = Date.now();
    const updated: ServiceStatus[] = [];

    // Simple health
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
      const latency = Date.now() - start;
      if (res.ok) {
        updated.push({ name: 'API Server', status: 'ok', latency });
      } else {
        updated.push({ name: 'API Server', status: 'degraded', latency, details: `HTTP ${res.status}` });
      }
    } catch {
      updated.push({ name: 'API Server', status: 'down', details: 'Unreachable' });
    }

    // Deep health
    try {
      const res = await fetch(`${API_BASE}/health/deep`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const checks = data.checks || {};

        updated.push({
          name: 'Database',
          status: checks.database?.status === 'ok' ? 'ok' : 'down',
          details: checks.database?.status === 'ok' ? undefined : checks.database?.error,
        });
        updated.push({
          name: 'Redis Queue',
          status: checks.redis?.status === 'ok' ? 'ok' : 'down',
          details: checks.redis?.status === 'ok' ? undefined : checks.redis?.error,
        });
        updated.push({
          name: 'Vector Memory (Qdrant)',
          status: checks.qdrant?.status === 'ok' ? 'ok' : checks.qdrant?.status === 'skipped' ? 'ok' : 'down',
          details: checks.qdrant?.status === 'skipped' ? 'Disabled' : checks.qdrant?.error,
        });
      } else {
        updated.push({ name: 'Database', status: 'degraded', details: 'Could not verify' });
        updated.push({ name: 'Redis Queue', status: 'degraded', details: 'Could not verify' });
        updated.push({ name: 'Vector Memory (Qdrant)', status: 'degraded', details: 'Could not verify' });
      }
    } catch {
      updated.push({ name: 'Database', status: 'degraded', details: 'Could not verify' });
      updated.push({ name: 'Redis Queue', status: 'degraded', details: 'Could not verify' });
      updated.push({ name: 'Vector Memory (Qdrant)', status: 'degraded', details: 'Could not verify' });
    }

    setServices(updated);
    setLastChecked(new Date().toLocaleTimeString());
  }

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const allOk = services.every((s) => s.status === 'ok');
  const anyDown = services.some((s) => s.status === 'down');

  const statusColor = (s: string) => {
    if (s === 'ok') return '#22c55e';
    if (s === 'degraded') return '#f59e0b';
    if (s === 'down') return '#ef4444';
    return 'var(--ink-35)';
  };

  const statusLabel = (s: string) => {
    if (s === 'ok') return t('status.operational');
    if (s === 'degraded') return t('status.degradedLabel');
    if (s === 'down') return t('status.down');
    return t('status.checking');
  };

  return (
    <div className='container page-container-narrow' style={{ maxWidth: 700, padding: '80px 24px' }}>
      <div style={{ marginBottom: 48 }}>
        <div className='section-label'>{t('status.label')}</div>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: 'var(--ink-90)', margin: '8px 0 16px' }}>
          {t('status.title')}
        </h1>

        {/* Overall banner */}
        <div
          style={{
            padding: '16px 24px',
            borderRadius: 14,
            background: allOk
              ? 'rgba(34,197,94,0.08)'
              : anyDown
              ? 'rgba(239,68,68,0.08)'
              : 'rgba(245,158,11,0.08)',
            border: `1px solid ${allOk ? 'rgba(34,197,94,0.25)' : anyDown ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: allOk ? '#22c55e' : anyDown ? '#ef4444' : '#f59e0b',
              boxShadow: `0 0 8px ${allOk ? 'rgba(34,197,94,0.5)' : anyDown ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'}`,
            }}
          />
          <span style={{ color: 'var(--ink-90)', fontWeight: 600, fontSize: 16 }}>
            {allOk ? t('status.allOk') : anyDown ? t('status.disruption') : t('status.degraded')}
          </span>
        </div>
      </div>

      {/* Service list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {services.map((svc) => (
          <div
            key={svc.name}
            style={{
              padding: '18px 24px',
              borderRadius: 14,
              border: '1px solid var(--panel-border-2)',
              background: 'var(--panel)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <div style={{ color: 'var(--ink-90)', fontWeight: 600, fontSize: 15 }}>{svc.name}</div>
              {svc.details && (
                <div style={{ color: 'var(--ink-35)', fontSize: 12, marginTop: 2 }}>{svc.details}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {svc.latency != null && (
                <span style={{ color: 'var(--ink-35)', fontSize: 12 }}>{svc.latency}ms</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: statusColor(svc.status),
                  }}
                />
                <span style={{ color: statusColor(svc.status), fontSize: 13, fontWeight: 600 }}>
                  {statusLabel(svc.status)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {lastChecked && (
        <p style={{ color: 'var(--ink-25)', fontSize: 12, marginTop: 24, textAlign: 'center' }}>
          {t('status.lastChecked')} {lastChecked} &middot; {t('status.autoRefresh')}
        </p>
      )}

      <div style={{ marginTop: 48, textAlign: 'center' }}>
        <Link href='/contact' style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none', fontWeight: 600 }}>
          {t('status.reportIssue')} →
        </Link>
      </div>
    </div>
  );
}
