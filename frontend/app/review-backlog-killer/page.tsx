import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Review Backlog Killer · Auto-Nudge Stuck PRs Before They Tank Velocity | AGENA',
  description: 'Pull requests get lost in review queues and silently drop team velocity. AGENA tracks every open PR, flags ones aging past your warn / critical thresholds, nudges reviewers via Slack DM, channel, email, or directly as a PR comment. Critical PRs auto-escalate.',
  keywords: [
    'PR review backlog automation',
    'auto-nudge PR reviewer',
    'stuck pull request alert',
    'PR review SLA Slack',
    'GitHub PR reviewer reminder',
    'Azure DevOps PR review nudge',
    'engineering velocity tool',
    'review queue dashboard',
  ],
  alternates: { canonical: 'https://agena.dev/review-backlog-killer' },
  openGraph: {
    type: 'article',
    url: 'https://agena.dev/review-backlog-killer',
    title: 'Review Backlog Killer — Stop PRs From Disappearing | AGENA',
    description: 'Tracks open PRs, flags ones aging past your thresholds, nudges reviewers via Slack / email / PR comment. Critical PRs auto-escalate.',
    images: ['/og-image.png'],
  },
};

const FAQ = [
  {
    q: 'How does AGENA know a PR is "stuck"?',
    a: 'A poller runs every 30 minutes against every open PR in your AGENA-tracked repos. PRs older than your warn threshold (default 24h) become "warning". Older than your critical threshold (default 48h) become "critical" and the row gets an escalation flag — surfacing it to team leads.',
  },
  {
    q: 'Where does the nudge actually land?',
    a: 'You pick the channel: Slack DM to the reviewer, Slack channel post, email, or a direct comment on the PR itself. Or "Manual only" if you just want the dashboard view. PR comment is the most attention-grabbing because it shows up where the reviewer already lives.',
  },
  {
    q: 'Do I have to manually nudge each PR?',
    a: 'No — every open PR past warn threshold appears in the queue. You can nudge individuals or let the auto-nudge fire on its own interval (chip-pick: every 1h, 3h, 6h, 12h, daily). The same reviewer won\'t get spammed: nudges respect the interval.',
  },
  {
    q: 'What about the AI review score?',
    a: 'If the AGENA Reviews module is also on, every PR carries the AI reviewer\'s score. The nudge message includes "AI score 84 — likely a quick approve" so the reviewer knows the time investment before clicking. PRs scoring ≥ 80 with no human review are the highest-leverage nudge targets.',
  },
  {
    q: 'Can I exempt repos?',
    a: 'Yes — comma-separated list of repo mapping ids in the settings. Useful for legacy repos in maintenance mode where review SLAs don\'t apply.',
  },
  {
    q: 'Does it work with Azure DevOps PRs?',
    a: 'Yes — the dashboard tracks PRs from any provider AGENA syncs (GitHub, Azure DevOps, GitLab, Bitbucket). PR-comment nudges are wired for GitHub today; the Azure / GitLab / Bitbucket comment paths fall through to other channels until those providers gain a comment helper.',
  },
];

export default function ReviewBacklogKillerPage() {
  const ldJson = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AGENA — Review Backlog Killer',
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
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
          Review Backlog Killer
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 800, lineHeight: 1.1, color: 'var(--ink-90)', margin: 0 }}>
          PRs disappear. <br />
          <span style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Velocity drops silently.</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-58)', marginTop: 18, maxWidth: 720, marginInline: 'auto', lineHeight: 1.55 }}>
          AGENA tracks every open PR, flags ones aging past your warn (default 24h) and critical (48h) thresholds,
          and nudges reviewers via Slack DM, channel, email, or directly as a comment on the PR itself. Critical
          PRs auto-escalate to team leads. Velocity stays where it should.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <Link href='/signup' style={{ padding: '12px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Start free
          </Link>
          <Link href='/dashboard/review-backlog' style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            See the dashboard →
          </Link>
        </div>
      </header>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Sample backlog row</h2>
        <pre style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--ink-78)', background: 'var(--panel)', border: '1px solid var(--panel-border)', borderLeft: '4px solid #ef4444', padding: 18, borderRadius: 12, overflowX: 'auto', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{`🔴  PR #4519  ·  CRITICAL · 47h  ·  🔔 1  ·  ⚠ escalated

"Refactor wallet checkout: stop re-attaching saved-card token"
👤 erinc.kanbur · 📦 repo #checkout-api
last nudged: 2 hours ago (slack_dm)

[ 🔔 Nudge reviewer ]`}</pre>
      </section>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>How it works</h2>
        <ol style={{ display: 'grid', gap: 12, paddingLeft: 0, listStyle: 'none' }}>
          {[
            { title: 'Set warn / critical / nudge intervals', desc: 'Chip-pick: 6h / 12h / 1d / 2d / 3d / 1w / custom. Defaults: 24h warn, 48h critical, 6h between auto-nudges.' },
            { title: 'Pick the channel', desc: 'Slack DM (most direct), Slack channel (visible to team), email, PR comment (lands where the reviewer already lives), or manual-only.' },
            { title: 'Poller runs every 30 minutes', desc: 'Updates age + severity on every open PR. PRs that merged or closed since last scan auto-resolve out of the backlog.' },
            { title: 'Critical PRs auto-escalate', desc: 'When a PR hits the critical threshold, the escalation flag fires once. Tech leads see it on the dashboard.' },
            { title: 'Manual nudge anytime', desc: 'Backlog page lists every stuck PR. Click "Nudge reviewer" on any row to fire the configured channel right now (overrides the interval).' },
          ].map((step, i) => (
            <li key={i} style={{ display: 'flex', gap: 16, padding: '14px 18px', borderRadius: 12, background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-90)' }}>{step.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-58)', marginTop: 4, lineHeight: 1.55 }}>{step.desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>What you get</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { icon: '⏱', title: 'Real-time stat strip', body: 'Open / critical / warning / avg age / escalated counts at the top — at-a-glance executive view.' },
            { icon: '🔔', title: 'Multi-channel nudge', body: 'Slack DM, Slack channel, email, or PR comment. PR comment is the killer — lands directly under the diff.' },
            { icon: '⚠️', title: 'Auto-escalation', body: 'Critical-threshold PRs flag once, tech leads see them above the fold.' },
            { icon: '🤖', title: 'Reviews-aware', body: 'When the Reviews module is also on, the nudge message embeds the AI review score so reviewers know the effort.' },
            { icon: '🔧', title: 'Configurable thresholds', body: 'Chip-pick warn / critical / nudge interval. Different teams have different SLAs — set yours.' },
            { icon: '🚫', title: 'Exempt repos', body: 'Maintenance / legacy repos can be skipped per workspace.' },
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
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Stop velocity from leaking through review queues</h2>
        <Link href='/signup' style={{ padding: '12px 28px', borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
          Start free
        </Link>
      </footer>
    </main>
  );
}
