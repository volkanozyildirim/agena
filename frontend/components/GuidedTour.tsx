'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import { useLocale } from '@/lib/i18n';

const LS_KEY = 'agena_tour_completed';

type TourStep = {
  target: string;          // data-tour attribute value
  titleKey: string;
  descKey: string;
};

const STEPS: TourStep[] = [
  { target: 'nav-overview',      titleKey: 'tour.step.overview.title',      descKey: 'tour.step.overview.desc' },
  { target: 'nav-office',        titleKey: 'tour.step.office.title',        descKey: 'tour.step.office.desc' },
  { target: 'nav-tasks',         titleKey: 'tour.step.tasks.title',         descKey: 'tour.step.tasks.desc' },
  { target: 'nav-sprints',       titleKey: 'tour.step.sprints.title',       descKey: 'tour.step.sprints.desc' },
  { target: 'nav-agents',        titleKey: 'tour.step.agents.title',        descKey: 'tour.step.agents.desc' },
  { target: 'nav-flows',         titleKey: 'tour.step.flows.title',         descKey: 'tour.step.flows.desc' },
  { target: 'nav-integrations',  titleKey: 'tour.step.integrations.title',  descKey: 'tour.step.integrations.desc' },
  { target: 'nav-dora',          titleKey: 'tour.step.dora.title',          descKey: 'tour.step.dora.desc' },
  { target: 'nav-notifications', titleKey: 'tour.step.notifications.title', descKey: 'tour.step.notifications.desc' },
];

export default function GuidedTour({ force }: { force?: boolean }) {
  const { t, lang } = useLocale();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (force) { setActive(true); return; }
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(LS_KEY)) setActive(true);
  }, [force]);

  const measure = useCallback(() => {
    if (!active) return;
    const el = document.querySelector(`[data-tour="${STEPS[step]?.target}"]`);
    if (el) {
      setRect(el.getBoundingClientRect());
    }
  }, [active, step]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  // re-measure on lang change
  useEffect(() => { measure(); }, [lang, measure]);

  function finish() {
    setActive(false);
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, '1');
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!active || !rect) return null;

  const current = STEPS[step];
  const pad = 6;
  const spotLeft = rect.left - pad;
  const spotTop = rect.top - pad;
  const spotW = rect.width + pad * 2;
  const spotH = rect.height + pad * 2;

  // tooltip position: prefer right, fallback left if no space
  const tooltipW = 320;
  const gap = 12;
  let tooltipLeft = spotLeft + spotW + gap;
  let tooltipTop = spotTop;
  let arrowSide: 'left' | 'right' = 'left';
  if (tooltipLeft + tooltipW > window.innerWidth - 20) {
    tooltipLeft = spotLeft - tooltipW - gap;
    arrowSide = 'right';
  }
  if (tooltipTop + 200 > window.innerHeight) {
    tooltipTop = window.innerHeight - 220;
  }
  if (tooltipTop < 10) tooltipTop = 10;

  return (
    <div style={overlayStyle}>
      {/* dark mask with cutout */}
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect x={spotLeft} y={spotTop} width={spotW} height={spotH} rx="10" fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#tour-mask)" />
      </svg>

      {/* spotlight border */}
      <div style={{
        position: 'fixed',
        left: spotLeft - 1,
        top: spotTop - 1,
        width: spotW + 2,
        height: spotH + 2,
        borderRadius: 11,
        border: '2px solid var(--accent)',
        boxShadow: '0 0 20px rgba(13,148,136,0.4)',
        pointerEvents: 'none',
        zIndex: 10001,
      }} />

      {/* tooltip card */}
      <div style={{
        position: 'fixed',
        left: tooltipLeft,
        top: tooltipTop,
        width: tooltipW,
        zIndex: 10002,
        background: 'var(--surface, #0d1117)',
        border: '1px solid var(--panel-border-3)',
        borderRadius: 14,
        padding: '18px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* arrow */}
        <div style={{
          position: 'absolute',
          top: 24,
          [arrowSide]: -7,
          width: 12,
          height: 12,
          background: 'var(--surface, #0d1117)',
          border: '1px solid var(--panel-border-3)',
          borderRight: arrowSide === 'left' ? 'none' : undefined,
          borderBottom: arrowSide === 'left' ? 'none' : undefined,
          borderLeft: arrowSide === 'right' ? 'none' : undefined,
          borderTop: arrowSide === 'right' ? 'none' : undefined,
          transform: arrowSide === 'left' ? 'rotate(-45deg)' : 'rotate(45deg)',
        }} />

        {/* step counter */}
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
          {step + 1} / {STEPS.length}
        </div>

        {/* title */}
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink-90, #fff)', marginBottom: 6 }}>
          {t(current.titleKey as Parameters<typeof t>[0])}
        </div>

        {/* description */}
        <div style={{ fontSize: 13, color: 'var(--ink-65, #aaa)', lineHeight: 1.5, marginBottom: 16 }}>
          {t(current.descKey as Parameters<typeof t>[0])}
        </div>

        {/* actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={finish} style={skipBtnStyle}>
            {t('tour.skip' as Parameters<typeof t>[0])}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={prev} style={ghostBtnStyle}>
                {t('tour.prev' as Parameters<typeof t>[0])}
              </button>
            )}
            <button onClick={next} style={nextBtnStyle}>
              {step < STEPS.length - 1
                ? t('tour.next' as Parameters<typeof t>[0])
                : t('tour.finish' as Parameters<typeof t>[0])}
            </button>
          </div>
        </div>

        {/* dots */}
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 12 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? 'var(--accent)' : 'var(--ink-25)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Reset tour so it shows again */
export function resetTour() {
  if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY);
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
};

const skipBtnStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--ink-42)',
  fontSize: 12,
  cursor: 'pointer',
  padding: '6px 0',
};

const ghostBtnStyle: CSSProperties = {
  border: '1px solid var(--panel-border-3)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--ink-65)',
  fontSize: 12,
  fontWeight: 600,
  padding: '7px 14px',
  cursor: 'pointer',
};

const nextBtnStyle: CSSProperties = {
  border: 'none',
  borderRadius: 8,
  background: 'var(--brand)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  padding: '7px 16px',
  cursor: 'pointer',
};
