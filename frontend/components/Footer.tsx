'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n';
import NewsletterForm from '@/components/NewsletterForm';

export default function Footer() {
  const pathname = usePathname();
  const { t } = useLocale();

  if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/signin') || pathname?.startsWith('/signup')) {
    return null;
  }

  return (
    <footer style={{ borderTop: '1px solid var(--panel-border)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 32, marginBottom: 32 }}>
          <div>
            <h4 style={{ color: 'var(--ink-65)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href='/use-cases' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>Use Cases</Link>
              <Link href='/contact' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>Contact</Link>
              <Link href='/changelog' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>Changelog</Link>
              <Link href='/docs' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>Documentation</Link>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--ink-65)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Resources</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href='/blog' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>Blog</Link>
              <Link href='/blog/what-is-agentic-ai' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>What is Agentic AI?</Link>
              <Link href='/blog/pixel-agent-technology' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>Pixel Agent Technology</Link>
              <Link href='/blog/github-copilot-alternative' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>AGENA vs Copilot</Link>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--ink-65)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Community</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href='https://github.com/aozyildirim/Agena' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>GitHub</a>
              <a href='https://github.com/sponsors/aozyildirim' target='_blank' rel='noreferrer' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>Sponsor</a>
              <a href='https://github.com/aozyildirim/Agena/issues' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>Issues</a>
              <Link href='/contact' style={{ color: 'var(--ink-35)', fontSize: 13, textDecoration: 'none' }}>Contact</Link>
            </div>
          </div>
        </div>
        {/* Newsletter */}
        <div style={{ paddingTop: 24, borderTop: '1px solid var(--panel-border)', textAlign: 'center', marginBottom: 24 }}>
          <h4 style={{ color: 'var(--ink-65)', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t('footer.stayInLoop')}</h4>
          <p style={{ color: 'var(--ink-35)', fontSize: 13, marginBottom: 16 }}>{t('footer.noSpam')}</p>
          <NewsletterForm />
        </div>

        <div style={{ textAlign: 'center', paddingTop: 24, borderTop: '1px solid var(--panel-border)' }}>
          <p style={{ color: 'var(--ink-25)', fontSize: 11 }}>
            &copy; {new Date().getFullYear()} AGENA. Agentic AI Platform &amp; Pixel Agent Technology.
          </p>
        </div>
      </div>
    </footer>
  );
}
