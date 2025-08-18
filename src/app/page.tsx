// src/app/page.tsx
export const revalidate = 60

import Link from "next/link"
import { prisma } from "../../lib/db"

export default async function HomePage() {
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      section: { select: { name: true, slug: true } },
      tags: { include: { tag: true } },
    },
  })

  return (
    <main className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Свежие новости</h1>

      <div className="space-y-6">
        {articles.map(a => (
          <article key={a.id} className="border rounded p-4">
            <div className="text-xs opacity-70 mb-1">
              {a.section?.name ?? "Без раздела"} •{" "}
              {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("ru-RU") : ""}
            </div>

            <h2 className="text-xl font-semibold">
              <Link href={`/news/${encodeURIComponent(a.slug)}`} className="hover:underline">
                {a.title}
              </Link>
            </h2>

            {a.excerpt && <p className="mt-2 text-sm text-neutral-700">{a.excerpt}</p>}

            {a.tags.length > 0 && (
              <div className="mt-3 text-xs flex flex-wrap gap-2">
                {a.tags.map(t => (
                  <a
                    key={t.tagId}
                    href={`/tag/${encodeURIComponent(t.tag.slug)}`}
                    className="px-2 py-1 rounded border hover:bg-gray-50"
                  >
                    #{t.tag.name}
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}

        {articles.length === 0 && (
          <div className="opacity-60">Пока нет опубликованных материалов.</div>
        )}
      </div>
    </main>
  )
}
