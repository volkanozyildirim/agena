'use client';

import Link from 'next/link';
import ContactForm from '@/components/ContactForm';
import { useLocale } from '@/lib/i18n';

export default function ContactPage() {
  const { t } = useLocale();

  return (
    <>
      <div className='container page-container-narrow' style={{ maxWidth: 860, padding: '80px 24px' }}>
        <div style={{ marginBottom: 48 }}>
          <div className='section-label'>{t('contact.label')}</div>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: 'var(--ink-90)', margin: '8px 0 16px' }}>
            {t('contact.title')}
          </h1>
          <p style={{ color: 'var(--ink-45)', fontSize: 16, lineHeight: 1.7, maxWidth: 600 }}>
            {t('contact.subtitle')}
          </p>
        </div>

        <div className='contact-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 48, alignItems: 'start' }}>
          <div
            className='contact-form-wrapper'
            style={{
              padding: '32px',
              borderRadius: 16,
              background: 'rgba(13,148,136,0.04)',
              border: '1px solid rgba(13,148,136,0.1)',
            }}
          >
            <ContactForm />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ padding: '24px', borderRadius: 14, background: 'rgba(13,148,136,0.04)', border: '1px solid rgba(13,148,136,0.1)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-90)', marginBottom: 12 }}>{t('contact.quickLinks')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link href='/docs' style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none' }}>Documentation</Link>
                <Link href='/changelog' style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none' }}>Changelog</Link>
                <Link href='/blog' style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none' }}>Blog</Link>
                <Link href='/use-cases' style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none' }}>{t('useCases.label')}</Link>
              </div>
            </div>

            <div style={{ padding: '24px', borderRadius: 14, background: 'rgba(13,148,136,0.04)', border: '1px solid rgba(13,148,136,0.1)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-90)', marginBottom: 12 }}>{t('contact.openSource')}</h3>
              <p style={{ color: 'var(--ink-45)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                {t('contact.openSourceDesc')}
              </p>
              <a href='https://github.com/aozyildirim/Agena' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none', fontWeight: 600 }}>
                github.com/aozyildirim/Agena
              </a>
            </div>

            <div style={{ padding: '24px', borderRadius: 14, background: 'rgba(13,148,136,0.04)', border: '1px solid rgba(13,148,136,0.1)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-90)', marginBottom: 12 }}>{t('contact.enterprise')}</h3>
              <p style={{ color: 'var(--ink-45)', fontSize: 13, lineHeight: 1.6 }}>
                {t('contact.enterpriseDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className='contact-faq' style={{ marginTop: 64 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-90)', marginBottom: 24 }}>
            {t('contact.faq.title')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <details
                key={i}
                style={{ padding: '18px 24px', borderRadius: 14, border: '1px solid var(--panel-border-2)', background: 'var(--panel)', cursor: 'pointer' }}
              >
                <summary style={{ color: 'var(--ink-90)', fontWeight: 600, fontSize: 15, lineHeight: 1.5, listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {t(`contact.faq${i}Q`)}
                  <span style={{ color: 'var(--ink-35)', fontSize: 18, marginLeft: 12, flexShrink: 0 }}>+</span>
                </summary>
                <p style={{ color: 'var(--ink-50)', fontSize: 14, lineHeight: 1.75, marginTop: 12 }}>
                  {t(`contact.faq${i}A`)}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
