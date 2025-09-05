export const dynamic = "force-dynamic";
/* eslint-disable @next/next/no-img-елement */

import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/db";
import ArticleCard from "@/app/components/ArticleCard";

// пагинация — как на странице медиа
function getPageNumbers(page: number, total: number): number[] | (-1)[] {
  const max = 7;
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const res: (number | -1)[] = [];
  const pushRange = (a: number, b: number) => { for (let i = a; i <= b; i++) res.push(i); };
  res.push(1);
  const left = Math.max(2, page - 1);
  const right = Math.min(total - 1, page + 1);
  if (left > 2) res.push(-1);
  pushRange(left, right);
  if (right < total - 1) res.push(-1);
  res.push(total);
  while (res.length > max) {
    if (res[1] !== -1) res.splice(1, 1);
    else if (res[res.length - 2] !== -1) res.splice(res.length - 2, 1);
    else res.splice(2, res.length - 4, -1);
  }
  return res as number[];
}

type SP = { q?: string; section?: string; tag?: string; page?: string; limit?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const sectionSlug = (sp.section || "").trim();
  const tagSlug = (sp.tag || "").trim();

  // пагинация
  const PER_PAGE = [10, 20, 30, 50] as const;
  const limitParsed = Number(sp.limit);
  const perPage = PER_PAGE.includes(limitParsed as any)
    ? (limitParsed as (typeof PER_PAGE)[number])
    : 20;

  const pageParsed = Number(sp.page);
  const page = Number.isFinite(pageParsed) && pageParsed > 0 ? Math.floor(pageParsed) : 1;

  // справочники для фильтров
  const [sections, tags] = await Promise.all([
    prisma.section.findMany({ select: { slug: true, name: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    prisma.tag.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // WHERE: только заголовок + выбранные раздел/тег
  const where: Prisma.ArticleWhereInput = {
    status: "PUBLISHED",
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(sectionSlug ? { section: { is: { slug: sectionSlug } } } : {}),
    ...(tagSlug ? { tags: { some: { tag: { slug: tagSlug } } } } : {}),
  };

  const total = await prisma.article.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * perPage;

  const items = await prisma.article.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: perPage,
    skip,
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      publishedAt: true,
      section: { select: { slug: true, name: true } },
      coverMedia: { select: { id: true } },
      tags: { include: { tag: true } },
    },
  });

  // количество опубликованных комментариев
  const ids = items.map((x) => x.id);
  const commentsGrouped = ids.length
    ? await prisma.comment.groupBy({
        by: ["articleId"],
        where: { articleId: { in: ids }, status: "PUBLISHED" },
        _count: { articleId: true },
      })
    : [];
  const commentsById = new Map<string, number>(commentsGrouped.map((g) => [g.articleId, g._count.articleId]));

  // helper для ссылок
  const qs = (p: number, l: number = perPage) =>
    `?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(sectionSlug ? { section: sectionSlug } : {}),
      ...(tagSlug ? { tag: tagSlug } : {}),
      page: String(p),
      limit: String(l),
    }).toString()}`;

  const pageNums = getPageNumbers(currentPage, totalPages);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold">Новости</h1>

      {/* Фильтры + кнопка в одной строке */}
      <form action="/search" method="GET" className="mt-4 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs opacity-70">Название</label>
          <input name="q" defaultValue={q} placeholder="Поиск по заголовку…" className="w-full rounded border px-3 py-2" />
        </div>

        <div>
          <label className="mb-1 block text-xs opacity-70">Раздел</label>
          <select name="section" defaultValue={sectionSlug} className="w-full rounded border px-3 py-2">
            <option value="">Все разделы</option>
            {sections.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs opacity-70">Тег</label>
          <select name="tag" defaultValue={tagSlug} className="w-full rounded border px-3 py-2">
            <option value="">Все теги</option>
            {tags.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end justify-end gap-2">
          <button type="submit" className="rounded bg-black px-3 py-2 text-white hover:bg-neutral-800">
            Применить
          </button>
          {(q || sectionSlug || tagSlug) && (
            <Link href="/search" className="rounded border px-3 py-2 hover:bg-gray-50">
              Сбросить
            </Link>
          )}
        </div>
      </form>

      {/* Результаты */}
      <div className="mt-6 space-y-5">
        {items.map((a) => (
          <ArticleCard
            key={a.id}
            id={a.id}
            slug={a.slug}
            title={a.title}
            subtitle={a.subtitle ?? null}
            publishedAt={a.publishedAt ?? undefined}
            section={{ slug: a.section?.slug ?? null, name: a.section?.name ?? null }}
            coverId={a.coverMedia?.id ?? null}
            tags={a.tags.map((x) => ({ id: x.tag.id, name: x.tag.name, slug: x.tag.slug }))}
            commentsCount={commentsById.get(a.id) ?? 0}
          />
        ))}

        {items.length === 0 && (
          <div className="rounded border p-4 text-sm opacity-70">Ничего не найдено.</div>
        )}
      </div>

      {/* Пагинация + «Показывать по» на одном уровне */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <div className="text-sm opacity-70">Стр. {currentPage} из {totalPages}</div>

        <div className="flex items-center">
          {/* «Показывать по» слева от пагинации и чуть отступ */}
          <div className="mr-4 md:mr-6 flex items-center gap-2 text-sm">
            <span className="opacity-70">Показывать по:</span>
            <div className="flex overflow-hidden rounded border">
              {PER_PAGE.map((n) => (
                <Link
                  key={n}
                  href={qs(1, n)}
                  className={
                    "px-2.5 py-1.5 border-l first:border-l-0 " +
                    (n === perPage ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50")
                  }
                  aria-current={n === perPage ? "page" : undefined}
                >
                  {n}
                </Link>
              ))}
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <Link
              href={qs(Math.max(1, currentPage - 1))}
              aria-disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded border ${currentPage === 1 ? "pointer-events-none opacity-40" : ""}`}
            >
              ←
            </Link>

            {pageNums.map((n, i) =>
              n === -1 ? (
                <span key={`e${i}`} className="select-none px-2 opacity-60">…</span>
              ) : (
                <Link
                  key={n}
                  href={qs(n)}
                  className={`px-3 py-1.5 rounded border ${n === currentPage ? "bg-black text-white border-black" : ""}`}
                  aria-current={n === currentPage ? "page" : undefined}
                >
                  {n}
                </Link>
              )
            )}

            <Link
              href={qs(Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded border ${currentPage === totalPages ? "pointer-events-none opacity-40" : ""}`}
            >
              →
            </Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
