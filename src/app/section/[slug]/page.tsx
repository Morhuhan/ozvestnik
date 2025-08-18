// app/section/[slug]/page.tsx
export const revalidate = 60

import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "../../../../lib/db"

export default async function SectionPage({ params }: { params: { slug: string } }) {
  const section = await prisma.section.findUnique({
    where: { slug: params.slug },
  })
  if (!section) return notFound()

  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED", sectionId: section.id },
    orderBy: { publishedAt: "desc" },
    take: 50,
  })

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{section.name}</h1>
      <ul className="space-y-3">
        {articles.map((a) => (
          <li key={a.id}>
            <Link href={`/news/${a.slug}`} className="font-medium">{a.title}</Link>
            {a.subtitle && <p className="text-sm opacity-70">{a.subtitle}</p>}
          </li>
        ))}
      </ul>
    </main>
  )
}
