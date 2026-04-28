'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n';

interface Commit {
  hash: string;
  short: string;
  message: string;
  date: string;
  author: string;
  type: 'feat' | 'fix' | 'docs' | 'other';
}

const typeBadgeStyle: Record<string, { bg: string; color: string }> = {
  feat: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
  fix: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  docs: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  other: { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6' },
};

export default function ChangelogPage() {
  const { t } = useLocale();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/changelog-data.json')
      .then((r) => r.json())
      .then((data) => { setCommits(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? commits : commits.filter((c) => c.type === filter);

  // Group by date
  const grouped: Record<string, Commit[]> = {};
  for (const c of filtered) {
    if (!grouped[c.date]) grouped[c.date] = [];
    grouped[c.date].push(c);
  }
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const isOpen = (date: string, idx: number) => (date in expanded ? expanded[date] : idx < 3);

  return (
    <div className='container changelog-container' style={{ maxWidth: 760, padding: '80px 24px' }}>
      <div style={{ marginBottom: 48 }}>
        <div className='section-label'>{t('changelog.label')}</div>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: 'var(--ink-90)', margin: '8px 0 16px' }}>
          {t('changelog.title')}
        </h1>
        <p style={{ color: 'var(--ink-45)', fontSize: 16, lineHeight: 1.7 }}>
          {t('changelog.subtitle')}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: t('changelog.filterAll') },
          { key: 'feat', label: t('changelog.filterFeat') },
          { key: 'fix', label: t('changelog.filterFix') },
          { key: 'docs', label: t('changelog.filterDocs') },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              border: filter === f.key ? '1px solid rgba(13,148,136,0.5)' : '1px solid var(--panel-border-2)',
              background: filter === f.key ? 'rgba(13,148,136,0.15)' : 'transparent',
              color: filter === f.key ? '#5eead4' : 'var(--ink-50)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-35)' }}>
          {t('changelog.loading')}
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 32 }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--panel-border-2)' }} />

          {dates.map((date, dateIdx) => {
            const open = isOpen(date, dateIdx);
            return (
            <div key={date} style={{ marginBottom: 32 }}>
              {/* Date header — clickable to toggle the day's commit list */}
              <button
                type='button'
                onClick={() => setExpanded((prev) => ({ ...prev, [date]: !open }))}
                style={{
                  position: 'relative',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ position: 'absolute', left: -28, top: 4, width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg)' }} />
                <time style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-65)' }}>{date}</time>
                <span style={{ fontSize: 12, color: 'var(--ink-35)', fontWeight: 500 }}>
                  · {grouped[date].length}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-50)', transition: 'transform .15s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  ▶
                </span>
              </button>

              {/* Commits for this date */}
              {open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grouped[date].map((commit) => {
                  const badge = typeBadgeStyle[commit.type] || typeBadgeStyle.other;
                  const badgeLabel = t(`changelog.badge.${commit.type}`) || t('changelog.badge.other');
                  return (
                    <div
                      key={commit.hash}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: '1px solid var(--panel-border)',
                        background: 'var(--panel)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                        {badgeLabel}
                      </span>
                      <span style={{ color: 'var(--ink-78)', fontSize: 14, flex: 1, minWidth: 0 }}>
                        {commit.message}
                      </span>
                      <code style={{ color: 'var(--ink-30)', fontSize: 12, flexShrink: 0 }}>
                        {commit.short}
                      </code>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 40, padding: '32px', borderRadius: 16, border: '1px solid var(--panel-border-2)', background: 'var(--panel)' }}>
        <p style={{ color: 'var(--ink-50)', marginBottom: 16 }}>
          {t('changelog.cta')}
        </p>
        <Link href='/signup' className='button button-primary' style={{ padding: '12px 28px', fontSize: 15 }}>
          Start Free →
        </Link>
      </div>
    </div>
  );
}
