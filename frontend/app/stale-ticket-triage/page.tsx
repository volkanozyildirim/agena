import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Stale Ticket Triage · AI Auto-Closes Idle Jira & Azure Tickets | AGENA',
  description: 'Stop the Friday triage meeting. AGENA scans your Jira and Azure DevOps backlog on a schedule, identifies tickets idle past your threshold, and recommends close / snooze / keep with reasoning. Bulk-approve in one click.',
  keywords: [
    'AI Jira triage',
    'auto-close stale Jira tickets',
    'Jira backlog automation',
    'stale ticket bulk close',
    'Azure DevOps stale work items',
    'weekly triage automation',
    'backlog grooming AI',
    'Jira ticket cleanup AI',
  ],
  alternates: { canonical: 'https://agena.dev/stale-ticket-triage' },
  openGraph: {
    type: 'article',
    url: 'https://agena.dev/stale-ticket-triage',
    title: 'Stale Ticket Triage — Kill the Friday Triage Meeting | AGENA',
    description: 'AI scans Jira + Azure backlog for idle tickets, recommends close/snooze/keep. Bulk-approve. Schedule + threshold + sources are all configurable.',
    images: ['/og-image.png'],
  },
};

const FAQ = [
  {
    q: 'What does "stale" actually mean?',
    a: 'Configurable per workspace. Default is 30 days without status / comment / field changes. The threshold is a chip selector on /dashboard/triage settings — 7d, 14d, 30d, 60d, 90d, or a custom number.',
  },
  {
    q: 'How does the AI decide between close / snooze / keep?',
    a: 'A short LLM call per ticket reads the title, description, idle days, linked PR (if any), branch (if any), and recent activity, then emits one of three verdicts plus a one-sentence reason. The system prompt is conservative: it picks "close" only when the ticket itself signals resolution (e.g. references a merged PR), defaults to "snooze" otherwise, and stays "keep" when active signals exist.',
  },
  {
    q: 'Does it actually update Jira / Azure DevOps?',
    a: 'When you approve a verdict, the AGENA-side TaskRecord status flips. Full source-system writeback (Jira transition, Azure work-item state change) is opt-in per integration; the audit row stays put either way.',
  },
  {
    q: 'How often does the scan run?',
    a: 'Choose from chip presets: every 6h, every 12h, daily 9am, weekly Sundays 18:00, monthly. Or paste your own cron expression for advanced schedules. UTC.',
  },
  {
    q: 'What sources are supported?',
    a: 'Jira and Azure DevOps today. GitHub Issues and Linear chips are present in the source picker — they\'ll be wired up as those integrations land.',
  },
  {
    q: 'Will I lose the audit trail if I bulk-approve?',
    a: 'No. Every triage decision (AI verdict, user approval, applied verdict, timestamp, user id) lives in the triage_decisions table. Replays + rollbacks possible. SOC2-friendly.',
  },
];

export default function StaleTicketTriagePage() {
  const ldJson = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AGENA — Stale Ticket Triage',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description: metadata.description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'AGENA', url: 'https://agena.dev' },
  };
  const faqJson = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '40px 20px', display: 'grid', gap: 48 }}>
      <Script id='ld-app' type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />
      <Script id='ld-faq' type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }} />

      <header style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
          Stale Ticket Triage
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 800, lineHeight: 1.1, color: 'var(--ink-90)', margin: 0 }}>
          Stop spending Friday afternoon <br />
          <span style={{ background: 'linear-gradient(90deg, #10b981, #06b6d4)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>grooming the backlog</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-58)', marginTop: 18, maxWidth: 720, marginInline: 'auto', lineHeight: 1.55 }}>
          AGENA scans your Jira and Azure DevOps backlog on a schedule, identifies tickets idle past your threshold,
          and recommends close, snooze, or keep — with one-sentence reasoning. Bulk-approve in a click. The weekly
          triage meeting goes away.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <Link href='/signup' style={{ padding: '12px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Start free
          </Link>
          <Link href='/dashboard/triage' style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            See the dashboard →
          </Link>
        </div>
      </header>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Sample triage queue entry</h2>
        <pre style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--ink-78)', background: 'var(--panel)', border: '1px solid var(--panel-border)', borderLeft: '4px solid #10b981', padding: 18, borderRadius: 12, overflowX: 'auto', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{`🪐  SUP-128  ·  47 days idle  ·  AI: ✓ close · 75%

"Mobile app crash on settings page"

🤖  Looks resolved by PR #4221 (merged 38 days ago); customer
   hasn't responded since.

[ ✓✓ Apply AI ]   [ ✓ Close ]   [ ⏸ Snooze ]   [ ⛔ Keep ]   [ ↩ Skip ]`}</pre>
      </section>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>How it works</h2>
        <ol style={{ display: 'grid', gap: 12, paddingLeft: 0, listStyle: 'none' }}>
          {[
            { title: 'Connect Jira / Azure DevOps', desc: 'Existing AGENA integrations — no extra setup. Triage uses the imported task cache, no extra API hits.' },
            { title: 'Set the threshold', desc: 'Chip-pick: 7d / 14d / 30d / 60d / 90d / custom days. Pick which sources to scan: Jira, Azure DevOps, GitHub Issues, Linear (chips).' },
            { title: 'Schedule the scan', desc: 'Chip-pick: every 6h, every 12h, daily 9am, weekly Sundays 18:00, monthly. Or custom cron. UTC.' },
            { title: 'AI emits a verdict per ticket', desc: 'close / snooze / keep + a one-sentence reason. Conservative by default — only picks close when the ticket itself signals resolution.' },
            { title: 'Bulk-approve in one click', desc: '"Apply all AI suggestions" applies the AI verdict to every pending decision in one go. Per-row override available.' },
          ].map((step, i) => (
            <li key={i} style={{ display: 'flex', gap: 16, padding: '14px 18px', borderRadius: 12, background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-90)' }}>{step.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-58)', marginTop: 4, lineHeight: 1.55 }}>{step.desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>What you save</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { icon: '⏱', title: '1 hour / week / PM', body: 'A typical Friday triage meeting eats one hour per PM. AGENA runs the scan overnight; you bulk-approve in 90 seconds Monday morning.' },
            { icon: '🧹', title: 'Backlog stays honest', body: 'Stale tickets accumulate fast. AGENA scrubs them weekly so your Now / Next / Later signal isn\'t drowned out by 200 dead rows.' },
            { icon: '🤖', title: 'Conservative defaults', body: 'AI defaults to "snooze" when it\'s unsure. Only picks "close" when the ticket itself says so (links a merged PR, mentions a follow-up, etc).' },
            { icon: '📋', title: 'Per-source filtering', body: 'Toggle Jira / Azure / GitHub / Linear independently — different teams, different sources.' },
            { icon: '🛡️', title: 'Full audit trail', body: 'Every AI verdict + every human override is logged with timestamp + user id. Replay if needed.' },
            { icon: '🔧', title: 'No code changes', body: 'Already using Jira / Azure DevOps? Triage works on top — no agents written, no flows wired.' },
          ].map((f) => (
            <div key={f.title} style={{ padding: 16, borderRadius: 12, background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-90)' }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-58)', marginTop: 6, lineHeight: 1.55 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Frequently asked</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {FAQ.map((f) => (
            <details key={f.q} style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--ink-90)' }}>{f.q}</summary>
              <p style={{ fontSize: 13, color: 'var(--ink-58)', marginTop: 8, lineHeight: 1.6 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '40px 0', borderTop: '1px solid var(--panel-border)' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Get your Friday afternoon back</h2>
        <Link href='/signup' style={{ padding: '12px 28px', borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
          Start free
        </Link>
      </footer>
    </main>
  );
}
