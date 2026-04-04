'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n';

export default function CookieConsent() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('agena_cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem('agena_cookie_consent', 'accepted');
    setVisible(false);
  }

  function decline() {
    localStorage.setItem('agena_cookie_consent', 'declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        right: 24,
        maxWidth: 480,
        zIndex: 9999,
        padding: '20px 24px',
        borderRadius: 16,
        background: 'var(--cookie-bg, rgba(3,7,18,0.95))',
        border: '1px solid var(--cookie-border, rgba(13,148,136,0.2))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--cookie-shadow, 0 8px 32px rgba(0,0,0,0.4))',
        animation: 'slideUp 0.4s ease',
      }}
    >
      <p style={{ color: 'var(--ink-78)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        {t('cookie.text')}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={accept}
          className='button button-primary'
          style={{ padding: '8px 20px', fontSize: 13 }}
        >
          {t('cookie.accept')}
        </button>
        <button
          onClick={decline}
          style={{
            padding: '8px 20px',
            fontSize: 13,
            borderRadius: 10,
            border: '1px solid var(--panel-border-3)',
            background: 'transparent',
            color: 'var(--ink-50)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('cookie.decline')}
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
