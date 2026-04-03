const SITE = 'https://agena.dev';

const posts = [
  { slug: 'agentic-ai-nedir', title: 'Agentic AI Nedir? Otonom Yapay Zeka Sistemlerinin Geleceği', date: '2026-04-01', description: 'Agentic AI nedir, geleneksel yapay zekadan farkı ne? Otonom AI agentların yazılım geliştirme, kod üretimi ve PR otomasyonundaki devrimci rolünü keşfedin.' },
  { slug: 'ai-ile-pr-otomasyonu', title: 'AI ile Pull Request Otomasyonu: Backlog\'dan PR\'a Dakikalar İçinde', date: '2026-04-03', description: 'AI ile otomatik pull request oluşturma nasıl çalışır? AGENA\'nın agentic AI pipeline\'ı ile görev tanımından production-ready PR\'a kadar tüm süreci öğrenin.' },
  { slug: 'otonom-kodlama-rehberi', title: 'Otonom Kodlama: AI Agentlar ile Yazılım Geliştirmenin Yeni Çağı', date: '2026-04-02', description: 'Otonom kodlama nedir ve nasıl çalışır? AI agentların bağımsız olarak kod yazması, review etmesi ve PR açması hakkında kapsamlı rehber.' },
  { slug: 'yapay-zeka-ile-kod-yazma', title: 'Yapay Zeka ile Kod Yazma: AGENA ile Otonom Geliştirme Rehberi', date: '2026-03-30', description: 'Yapay zeka ile kod yazma artık hayal değil. AGENA\'nın agentic AI platformu ile otonom kod üretimi, PR oluşturma ve kalite kontrolünü öğrenin.' },
  { slug: 'ai-agent-nedir', title: 'AI Agent Nedir? Yapay Zeka Agentlarının Yazılım Geliştirmedeki Rolü', date: '2026-03-29', description: 'AI agent nedir, nasıl çalışır ve yazılım geliştirmede nasıl kullanılır?' },
  { slug: 'what-is-agentic-ai', title: 'What is Agentic AI? The Future of Autonomous Software Development', date: '2026-03-28', description: 'Agentic AI represents a paradigm shift in software development.' },
  { slug: 'github-copilot-alternative', title: 'AGENA vs GitHub Copilot: The Agentic AI Alternative for Full Autonomy', date: '2026-03-27', description: 'Compare AGENA with GitHub Copilot. While Copilot suggests code line by line, AGENA autonomously generates complete PRs.' },
  { slug: 'pixel-agent-technology', title: 'Pixel Agent Technology: How AGENA Orchestrates AI Workflows Visually', date: '2026-03-25', description: 'Discover how pixel agent technology powers AGENA\'s visual orchestration layer.' },
  { slug: 'ai-code-generation-best-practices', title: 'AI Code Generation Best Practices: From Backlog to Pull Request in Minutes', date: '2026-03-20', description: 'How to leverage agentic AI for production-grade code generation.' },
  { slug: 'crewai-langgraph-orchestration', title: 'Building Multi-Agent Pipelines with CrewAI and LangGraph', date: '2026-03-15', description: 'A deep dive into how AGENA combines CrewAI with LangGraph for reliable AI pipelines.' },
  { slug: 'multi-tenant-ai-saas-architecture', title: 'Designing a Multi-Tenant AI SaaS: Lessons from Building AGENA', date: '2026-03-10', description: 'Architecture decisions behind building a production-ready multi-tenant AI agent platform.' },
];

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET() {
  const items = posts
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
      <description>${escapeXml(p.description)}</description>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    </item>`
    )
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AGENA Blog — Agentic AI Platform</title>
    <link>${SITE}/blog</link>
    <description>Insights on agentic AI, autonomous code generation, pixel agent technology, and AI-powered software development from the AGENA team.</description>
    <language>en-tr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE}/media/agena-logo.svg</url>
      <title>AGENA</title>
      <link>${SITE}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
