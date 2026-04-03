import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation – AGENA Agentic AI Platform',
  description:
    'AGENA documentation — setup guide, dashboard walkthrough, integrations, ChatOps, API reference, and deployment. Complete guide for the agentic AI platform.',
  alternates: { canonical: '/docs' },
  openGraph: {
    title: 'Documentation – AGENA Agentic AI Platform',
    description: 'Complete documentation for the AGENA agentic AI platform.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AGENA Documentation' }],
  },
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://agena.dev' },
    { '@type': 'ListItem', position: 2, name: 'Documentation', item: 'https://agena.dev/docs' },
  ],
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {children}
    </>
  );
}
