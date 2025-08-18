// src/app/news/[slug]/page.tsx
export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { prisma } from "../../../../lib/db"

function renderContent(content: any) {
  const paras: string[] =
    content?.content?.map((p: any) => p?.content?.map((t: any) => t?.text || "").join("")) || []
  return paras.map((p, i) => <p key={i} className="mt-4 leading-relaxed">{p}</p>)
}

export default async function ArticlePublicPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw)

  const a = await prisma.article.findUnique({
    where: { slug },
    include: {
      section: true,
      tags: { include: { tag: true } },
      authors: { include: { author: true }, orderBy: { order: "asc" } }, // ⬅️
    },
  })
  if (!a || a.status !== "PUBLISHED") notFound()

  const authorsFio = a.authors.length
    ? a.authors.map(x => [x.author.lastName, x.author.firstName, x.author.patronymic].filter(Boolean).join(" ")).join(", ")
    : "—"

  return (
    <article className="container mx-auto p-4 max-w-3xl">
      <div className="text-sm opacity-70">
        {a.section?.name ?? "Без раздела"} • {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("ru-RU") : ""}
      </div>
      <h1 className="text-3xl font-bold mt-2">{a.title}</h1>
      {a.subtitle && <p className="mt-2 text-neutral-700">{a.subtitle}</p>}
      <div className="mt-6">{renderContent(a.content)}</div>
      <div className="mt-6 border-t pt-6 text-sm opacity-80">Автор(ы): {authorsFio}</div>
      {a.tags.length > 0 && (
        <div className="mt-3 text-sm flex flex-wrap gap-2">
          {a.tags.map(t => (
            <a key={t.tagId} className="px-2 py-1 rounded border text-xs hover:bg-gray-50" href={`/tag/${encodeURIComponent(t.tag.slug)}`}>
              #{t.tag.name}
            </a>
          ))}
        </div>
      )}
    </article>
  )
}
