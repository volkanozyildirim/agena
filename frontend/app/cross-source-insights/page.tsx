import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Cross-Source Insights · Connect Sentry, NewRelic, Jira, and PR Merges into One Timeline | AGENA',
  description: 'AGENA correlates events across Sentry, NewRelic, Datadog, AppDynamics, Jira, Azure DevOps and your PR / deploy stream. Confidence-scored clusters tell you which deploy caused which bug — in seconds, not 20 minutes of tab-switching.',
  keywords: [
    'cross-source incident correlation',
    'AI deploy root cause',
    'which deploy caused this bug',
    'Sentry deploy correlation',
    'PR merge correlation Sentry',
    'unified observability AI',
    'incident timeline AI',
    'production incident AI',
    'monitoring correlation engine',
  ],
  alternates: { canonical: 'https://agena.dev/cross-source-insights' },
  openGraph: {
    type: 'article',
    url: 'https://agena.dev/cross-source-insights',
    title: 'Cross-Source Insights — Which Deploy Caused This Bug? | AGENA',
    description: 'Correlate PR merges + Sentry / NewRelic / Datadog / AppDynamics / Jira / Azure events on one timeline. Confidence-scored clusters in seconds.',
    images: ['/og-image.png'],
  },
};

const FAQ = [
  {
    q: 'How does AGENA correlate events from different sources?',
    a: 'A poller runs every 5 minutes, pulling the last hour of events from every connected source — PR merges, deploys, Sentry / NewRelic / Datadog / AppDynamics imports, Jira / Azure DevOps work item imports. It scores each candidate cluster on a 0-100 confidence scale: PR-blamed shapes (PR + monitoring + work-item co-occurrence) score highest. Clusters above 70 surface on the Insights page; lower-confidence ones stay in the database for audit.',
  },
  {
    q: 'Does this replace my observability tools?',
    a: 'No — AGENA reads what your existing tools already capture. You keep Sentry / NewRelic / Datadog as the source of truth for errors. AGENA is the layer that ties their signals together with your deploys, PRs, and tickets so you don\'t need to manually cross-reference five tabs during an incident.',
  },
  {
    q: 'What if the cluster is wrong?',
    a: 'Each cluster has a "Confirmed / False positive / Undo" workflow. Marking a cluster false-positive feeds into a future tuning step where the engine learns which signal combinations should drop confidence. Clusters never auto-act — they\'re recommendations.',
  },
  {
    q: 'How does the "1 click → revert PR" flow work?',
    a: 'On a confirmed cluster, an "Open rollback PR" button generates a revert PR for the suspected commit on GitHub or Azure DevOps via the existing AGENA git client. Reviewer is auto-assigned. The original cluster is preserved as evidence in the rollback PR description.',
  },
  {
    q: 'Can I see the engine\'s reasoning?',
    a: 'Yes — every cluster carries a one-sentence narrative ("PR #4519 merged at 14:18 in checkout-api correlates with 2 monitoring signals and 1 work item opened in the same window") plus a full timeline of every event in the cluster, each with its source-system permalink.',
  },
  {
    q: 'Is this gated behind a module?',
    a: 'Yes — the "Insights" module on /dashboard/modules. Default off for new tenants so you don\'t see the sidebar entry until you opt in. Once enabled, the poller starts producing clusters within 5 minutes of the next event window.',
  },
];

export default function CrossSourceInsightsPage() {
  const ldJson = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AGENA — Cross-Source Insights',
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
        <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
          Cross-Source Insights
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 800, lineHeight: 1.1, color: 'var(--ink-90)', margin: 0 }}>
          "Which deploy caused this bug?" <br />
          <span style={{ background: 'linear-gradient(90deg, #6366f1, #06b6d4)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>answered in 5 seconds, not 20 minutes</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-58)', marginTop: 18, maxWidth: 720, marginInline: 'auto', lineHeight: 1.55 }}>
          AGENA correlates PR merges, deploys, Sentry / NewRelic / Datadog / AppDynamics errors and Jira / Azure
          DevOps work items into confidence-scored clusters. One timeline, one narrative, one click to rollback —
          the war-room view your senior engineer keeps in their head, made shareable.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <Link href='/signup' style={{ padding: '12px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #06b6d4)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Start free
          </Link>
          <Link href='/dashboard/insights' style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            See the dashboard →
          </Link>
        </div>
      </header>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>What a cluster looks like</h2>
        <pre style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--ink-78)', background: 'var(--panel)', border: '1px solid var(--panel-border)', borderLeft: '4px solid #ef4444', padding: 18, borderRadius: 12, overflowX: 'auto', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{`🔴 CRITICAL  ·  confidence 94%

PR #4519 (erinc, merged 14:18) in checkout-api correlates with
2 monitoring signal(s) (sentry, newrelic) and 1 work-item opened
in the same window.

Timeline
  14:18  🔀 PR #4519 merged — 3 files, +47/-12 lines
  14:18  🚀 deploy a1b2c3d4 → production
  14:23  🚨 Sentry: TypeError in payment_service.py:88 (47×)
  14:24  📡 NewRelic: apdex 0.92 → 0.41
  14:31  🪐 Jira SUP-128 opened — 12 customers report failed checkout

[ ✓ Confirm ]   [ ✗ False positive ]   [ 📛 Open rollback PR ]`}</pre>
      </section>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>How it works</h2>
        <ol style={{ display: 'grid', gap: 12, paddingLeft: 0, listStyle: 'none' }}>
          {[
            { title: 'Connect your sources', desc: 'Sentry, NewRelic, Datadog, AppDynamics, Jira, Azure DevOps, GitHub. Each has its own integration page; the existing AGENA clients do the heavy lifting.' },
            { title: 'Poller runs every 5 minutes', desc: 'Pulls the last hour of events across every source. Cheap — pure DB reads on data the integrations already cache.' },
            { title: 'Cluster + score', desc: 'Heuristic confidence (0-100): PR merges score +40, deploys +20, monitoring signals +20, work-items +10. Bonus +10 for the PR-blamed shape.' },
            { title: 'Surface clusters ≥ 70', desc: 'They appear on /dashboard/insights with a one-sentence narrative, full timeline, severity badge, and triage actions.' },
            { title: 'Triage in one click', desc: 'Confirm → cluster moves to audit log + optionally opens rollback PR. False-positive → fed to threshold tuning. Undo if you misclick.' },
          ].map((step, i) => (
            <li key={i} style={{ display: 'flex', gap: 16, padding: '14px 18px', borderRadius: 12, background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-90)' }}>{step.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-58)', marginTop: 4, lineHeight: 1.55 }}>{step.desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Why this works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { icon: '🧠', title: 'Cross-tool by design', body: 'Every other tool sees its own silo. AGENA already integrates with your monitoring + tickets + git, so cross-source is a natural extension.' },
            { icon: '⚡', title: 'Sub-second triage', body: '20 minutes of "open Sentry → check deploy time → grep Jira" collapses to one click on a cluster card.' },
            { icon: '📊', title: 'Confidence-scored', body: '0-100 score per cluster, severity bucket, narrative — not a black box. Sort by impact.' },
            { icon: '🔁', title: 'One-click rollback', body: 'Confirmed cluster → revert PR opens with the suspected commit, reviewer auto-assigned, evidence linked.' },
            { icon: '🛡️', title: 'Auditable', body: 'Every cluster, every triage decision, every rollback is timestamped and recoverable. SOC2-friendly.' },
            { icon: '🌍', title: 'Module-gated', body: 'Default off. Enable per workspace from /dashboard/modules. New orgs don\'t see it until they opt in.' },
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
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Stop tab-hopping during incidents</h2>
        <Link href='/signup' style={{ padding: '12px 28px', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #06b6d4)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
          Start free
        </Link>
      </footer>
    </main>
  );
}
