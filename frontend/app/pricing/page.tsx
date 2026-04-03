import PricingCard from '@/components/PricingCard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing – AGENA Agentic AI Platform',
  description:
    'AGENA fiyatlandırma planları. Ücretsiz başlayın, AI agent destekli otonom kod üretimi ve PR oluşturma ile geliştirme sürecinizi hızlandırın.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing – AGENA Agentic AI Platform',
    description: 'Start free with AGENA. AI-powered autonomous code generation and pull request automation for development teams.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AGENA Pricing' }],
  },
};

export default function PricingPage() {
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://agena.dev' },
      { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://agena.dev/pricing' },
    ],
  };

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'AGENA – Agentic AI Platform',
    description: 'Autonomous AI agents that write code, review PRs, and ship features for development teams.',
    brand: { '@type': 'Organization', name: 'AGENA' },
    url: 'https://agena.dev/pricing',
    image: 'https://agena.dev/og-image.png',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
        description: '5 tasks/month, token usage tracking, community support',
        availability: 'https://schema.org/InStock',
        url: 'https://agena.dev/signup',
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '49',
        priceCurrency: 'USD',
        description: 'Unlimited tasks, priority worker throughput, team invites, Stripe + Iyzico billing',
        availability: 'https://schema.org/InStock',
        url: 'https://agena.dev/signup',
        priceValidUntil: '2027-12-31',
      },
    ],
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much does AGENA cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'AGENA offers a free tier with 5 AI tasks per month, token usage tracking, and community support. The Pro plan is $49/month and includes unlimited tasks, priority worker throughput, team invites, and billing via Stripe or Iyzico.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I use AGENA for free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes! The free plan includes 5 AI-powered tasks per month with full pipeline access (PM → Developer → Reviewer → Finalizer). No credit card required to start.',
        },
      },
      {
        '@type': 'Question',
        name: 'What counts as a task?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A task is a single work item assigned to the AI pipeline. When you create a task and click "Assign to AI", the pipeline runs through analysis, code generation, review, and PR creation — that counts as one task.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do I need my own OpenAI API key?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. AGENA uses your own LLM provider API keys (OpenAI, Google Gemini) so you have full control over model selection, cost, and data privacy. You configure your API key in Dashboard → Integrations.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I self-host AGENA?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes! AGENA is fully open source under the MIT license. You can self-host it with Docker Compose on your own infrastructure. The source code is available at github.com/aozyildirim/Agena.',
        },
      },
      {
        '@type': 'Question',
        name: 'What integrations does AGENA support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'AGENA integrates with GitHub and Azure DevOps for PR automation, Jira for task import, Slack/Microsoft Teams/Telegram for ChatOps commands and notifications, and supports OpenAI and Google Gemini as LLM providers.',
        },
      },
    ],
  };

  return (
    <>
    <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
    <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    <div className='grid'>
      <section className='card'>
        <h1 style={{ marginTop: 0 }}>Pricing</h1>
        <p style={{ color: '#475467' }}>Clear limits. No surprises.</p>
      </section>
      <section className='grid' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <PricingCard name='Free' price='$0' items={['5 tasks/month', 'Token usage tracking', 'Community support']} />
        <PricingCard
          name='Pro'
          price='$49/mo'
          items={['Unlimited tasks', 'Priority worker throughput', 'Team invites', 'Stripe + Iyzico billing']}
          highlight
        />
      </section>
    </div>
    </>
  );
}
