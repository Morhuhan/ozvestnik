import { MetadataRoute } from 'next';
import { prisma } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://xn----dtbhcghdehg5ad2aogq.xn--p1ai';

  const articles = await prisma.article.findMany({
    where: { 
      status: 'PUBLISHED',
      publishedAt: { not: null }
    },
    select: {
      slug: true,
      updatedAt: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: 'desc' },
  });

  const sections = await prisma.section.findMany({
    select: { slug: true },
  });

  const articleUrls = articles.map((article) => ({
    url: `${baseUrl}/news/${article.slug}`,
    lastModified: article.updatedAt || article.publishedAt || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const sectionUrls = sections.map((section) => ({
    url: `${baseUrl}/search?section=${section.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    ...articleUrls,
    ...sectionUrls,
  ];
}