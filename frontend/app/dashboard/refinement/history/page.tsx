'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type IndexPreview = {
  enabled: boolean;
  total: number;
  sp_distribution: { sp: number; count: number }[];
  top_assignees: { name: string; count: number }[];
  work_item_types: { type: string; count: number }[];
  samples: {
    external_id: string;
    title: string;
    story_points: number;
    assigned_to: string;
    url: string;
    work_item_type: string;
  }[];
};

type SortMode = 'recent' | 'sp_asc' | 'sp_desc' | 'assignee';

export default function RefinementHistoryPage() {
  const [preview, setPreview] = useState<IndexPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [spFilter, setSpFilter] = useState<number | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('recent');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<IndexPreview>('/refinement/history/preview');
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredSamples = useMemo(() => {
    if (!preview) return [];
    let rows = [...preview.samples];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.external_id.toLowerCase().includes(q) ||
        r.assigned_to.toLowerCase().includes(q),
      );
    }
    if (spFilter != null) rows = rows.filter((r) => Number(r.story_points) === spFilter);
    if (assigneeFilter) rows = rows.filter((r) => r.assigned_to === assigneeFilter);
    if (sort === 'sp_asc') rows.sort((a, b) => (a.story_points ?? 0) - (b.story_points ?? 0));
    if (sort === 'sp_desc') rows.sort((a, b) => (b.story_points ?? 0) - (a.story_points ?? 0));
    if (sort === 'assignee') rows.sort((a, b) => (a.assigned_to || '').localeCompare(b.assigned_to || ''));
    return rows;
  }, [preview, search, spFilter, assigneeFilter, sort]);

  const totalSp = useMemo(
    () => (preview?.sp_distribution || []).reduce((acc, x) => acc + x.sp * x.count, 0),
    [preview],
  );
  const avgSp = useMemo(
    () => (preview && preview.total > 0 ? totalSp / preview.total : 0),
    [preview, totalSp],
  );

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1200, paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          href='/dashboard/refinement'
          style={{
            fontSize: 12, color: 'var(--ink-45)', textDecoration: 'none',
            padding: '4px 10px', borderRadius: 8, border: '1px solid var(--panel-border)',
          }}
        >
          ← Refinement
        </Link>
        <div style={{ flex: 1 }}>
          <div className='section-label'>Refinement</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-90)', marginTop: 6, marginBottom: 2 }}>
            Geçmiş İş Index'i
          </h1>
          <p style={{ fontSize: 12, color: 'var(--ink-30)', margin: 0 }}>
            Refinement'ın SP önerilerini dayandırdığı Qdrant vektör deposu. Kapanmış, SP'si olan işler burada
            indexlenmiştir; yeni bir iş için LLM en yakın 3-5 tanesini referans alır.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            fontSize: 12, padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--panel-border-2)', background: 'var(--panel)',
            color: 'var(--ink-78)', cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Yükleniyor...' : '↻ Yenile'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)', color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && preview && preview.total === 0 && (
        <div style={{
          padding: 24, borderRadius: 14, border: '1px solid var(--panel-border-2)', background: 'var(--panel)',
          textAlign: 'center', color: 'var(--ink-45)',
        }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-78)', marginBottom: 4 }}>Index boş</div>
          <div style={{ fontSize: 12 }}>
            Refinement sayfasına git → <b>Geçmiş İşleri İndexle</b> butonuna bas.
          </div>
        </div>
      )}

      {preview && preview.total > 0 && (
        <>
          {/* Top stats */}
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {[
              { label: 'Toplam İş', value: preview.total.toLocaleString() },
              { label: 'Toplam SP', value: totalSp.toLocaleString() },
              { label: 'Ortalama SP', value: avgSp.toFixed(1) },
              { label: 'Farklı Kişi', value: String(preview.top_assignees.length) },
              { label: 'İş Tipi Çeşidi', value: String(preview.work_item_types.length) },
            ].map((s) => (
              <div key={s.label} style={{
                padding: '12px 14px', borderRadius: 12, border: '1px solid var(--panel-border-2)',
                background: 'var(--panel)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-45)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-90)', marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* SP distribution + WIT types side by side */}
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--panel-border-2)', background: 'var(--panel)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-45)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                SP Dağılımı (tıkla filtrele)
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {preview.sp_distribution.map(({ sp, count }) => {
                  const max = Math.max(...preview.sp_distribution.map((x) => x.count));
                  const pct = max ? (count / max) * 100 : 0;
                  const active = spFilter === sp;
                  return (
                    <button
                      key={sp}
                      onClick={() => setSpFilter(active ? null : sp)}
                      style={{
                        minWidth: 72, padding: '10px 12px', borderRadius: 10,
                        border: active ? '1.5px solid #5eead4' : '1px solid var(--panel-border)',
                        background: active
                          ? `linear-gradient(90deg, rgba(94,234,212,0.25) ${pct}%, rgba(94,234,212,0.08) ${pct}%)`
                          : `linear-gradient(90deg, rgba(94,234,212,0.15) ${pct}%, transparent ${pct}%)`,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: 11, color: active ? '#5eead4' : 'var(--ink-50)', fontWeight: 700 }}>{sp} SP</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink-90)' }}>{count}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--panel-border-2)', background: 'var(--panel)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-45)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                İş Tipleri
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {preview.work_item_types.map((t) => {
                  const max = preview.work_item_types[0]?.count || 1;
                  const pct = (t.count / max) * 100;
                  return (
                    <div key={t.type} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 48px', gap: 10, alignItems: 'center', fontSize: 12 }}>
                      <div style={{ color: 'var(--ink-78)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.type}
                      </div>
                      <div style={{ height: 5, background: 'var(--panel-border)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0d9488, #38bdf8)' }} />
                      </div>
                      <div style={{ textAlign: 'right', color: 'var(--ink-85)', fontWeight: 700 }}>{t.count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top assignees */}
          {preview.top_assignees.length > 0 && (
            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--panel-border-2)', background: 'var(--panel)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-45)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                En Çok İş Yapan (tıkla filtrele)
              </div>
              <div style={{ display: 'grid', gap: 5 }}>
                {preview.top_assignees.map((a) => {
                  const max = preview.top_assignees[0]?.count || 1;
                  const pct = (a.count / max) * 100;
                  const active = assigneeFilter === a.name;
                  return (
                    <button
                      key={a.name}
                      onClick={() => setAssigneeFilter(active ? null : a.name)}
                      style={{
                        display: 'grid', gridTemplateColumns: '260px 1fr 60px', gap: 10, alignItems: 'center',
                        fontSize: 12, padding: '4px 6px', borderRadius: 6,
                        background: active ? 'rgba(94,234,212,0.08)' : 'transparent',
                        border: active ? '1px solid rgba(94,234,212,0.35)' : '1px solid transparent',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ color: active ? '#5eead4' : 'var(--ink-78)', fontWeight: active ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </div>
                      <div style={{ height: 6, background: 'var(--panel-border)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0d9488, #5eead4)' }} />
                      </div>
                      <div style={{ textAlign: 'right', color: 'var(--ink-85)', fontWeight: 700 }}>{a.count}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Samples with filter bar */}
          <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--panel-border-2)', background: 'var(--panel)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-45)', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 }}>
                Örnek İşler ({filteredSamples.length} / {preview.samples.length})
              </div>
              {(spFilter != null || assigneeFilter) && (
                <button
                  onClick={() => { setSpFilter(null); setAssigneeFilter(null); setSearch(''); }}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--panel-border-2)', background: 'transparent', color: 'var(--ink-45)', cursor: 'pointer' }}
                >
                  filtreleri temizle
                </button>
              )}
              <input
                type='search'
                placeholder='başlık/ID/kişi ara...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--panel-border-2)', background: 'var(--panel-alt)', color: 'var(--ink-90)', minWidth: 200 }}
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--panel-border-2)', background: 'var(--panel-alt)', color: 'var(--ink-78)' }}
              >
                <option value='recent'>En Yeni</option>
                <option value='sp_desc'>SP ↓</option>
                <option value='sp_asc'>SP ↑</option>
                <option value='assignee'>Yapan (A-Z)</option>
              </select>
            </div>
            <div style={{ borderRadius: 10, border: '1px solid var(--panel-border)', background: 'var(--panel-alt)' }}>
              {filteredSamples.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-45)', fontSize: 12 }}>Hiç eşleşme yok.</div>
              ) : (
                filteredSamples.map((s, i) => (
                  <div key={s.external_id || i} style={{
                    padding: '8px 12px',
                    borderBottom: i < filteredSamples.length - 1 ? '1px solid var(--panel-border)' : 'none',
                    display: 'grid', gridTemplateColumns: '60px 90px 1fr 220px', gap: 10, alignItems: 'center', fontSize: 12,
                  }}>
                    <span style={{
                      fontWeight: 800, color: '#5eead4', textAlign: 'center',
                      padding: '3px 8px', borderRadius: 6, background: 'rgba(94,234,212,0.1)',
                      fontSize: 11,
                    }}>
                      {s.story_points} SP
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--ink-45)' }}>
                      {s.work_item_type || '—'}
                    </span>
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ color: 'var(--ink-85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.url ? (
                          <a href={s.url} target='_blank' rel='noreferrer' style={{ color: 'var(--ink-85)', textDecoration: 'none' }}>
                            #{s.external_id} {s.title}
                          </a>
                        ) : (
                          <span>#{s.external_id} {s.title}</span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--ink-58)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.assigned_to || '—'}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-35)', marginTop: 8 }}>
              Not: Listede en fazla 200 örnek gösterilir. Filtreyle daralt ya da tam liste için kaynak sistem'e git (Azure/Jira).
            </div>
          </div>
        </>
      )}
    </div>
  );
}
