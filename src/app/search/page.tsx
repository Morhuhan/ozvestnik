export const dynamic = "force-dynamic";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/db";
import ArticleCard from "@/app/components/ArticleCard";
import DateRangeInput from "@/app/components/DateRangeInput";

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

type SP = { q?: string; section?: string; tag?: string; author?: string; from?: string; to?: string; page?: string; limit?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const sectionSlug = (sp.section || "").trim();
  const tagSlug = (sp.tag || "").trim();
  const authorSlug = (sp.author || "").trim();
  const fromStr = (sp.from || "").trim();
  const toStr = (sp.to || "").trim();

  const PER_PAGE = [10, 20, 30, 50] as const;
  const limitParsed = Number(sp.limit);
  const perPage = PER_PAGE.includes(limitParsed as any) ? (limitParsed as (typeof PER_PAGE)[number]) : 20;

  const pageParsed = Number(sp.page);
  const page = Number.isFinite(pageParsed) && pageParsed > 0 ? Math.floor(pageParsed) : 1;

  const [sections, tags, authors] = await Promise.all([
    prisma.section.findMany({ select: { slug: true, name: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    prisma.tag.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    prisma.author.findMany({
      select: { slug: true, lastName: true, firstName: true, patronymic: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { patronymic: "asc" }],
    }),
  ]);

  const parseDate = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  let fromDate = fromStr ? parseDate(fromStr) : null;
  let toDate = toStr ? parseDate(toStr) : null;
  if (fromDate && toDate && fromDate > toDate) {
    const t = fromDate;
    fromDate = toDate;
    toDate = t;
  }
  const publishedFilter =
    fromDate || toDate
      ? {
          publishedAt: {
            ...(fromDate ? { gte: startOfDay(fromDate) } : {}),
            ...(toDate ? { lte: endOfDay(toDate) } : {}),
          },
        }
      : {};

  const where: Prisma.ArticleWhereInput = {
    status: "PUBLISHED",
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(sectionSlug ? { section: { is: { slug: sectionSlug } } } : {}),
    ...(tagSlug ? { tags: { some: { tag: { slug: tagSlug } } } } : {}),
    ...(authorSlug ? { authors: { some: { author: { slug: authorSlug } } } } : {}),
    ...publishedFilter,
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
      viewsCount: true,
      authors: {
        orderBy: { order: "asc" },
        include: {
          author: {
            select: { id: true, slug: true, firstName: true, lastName: true, patronymic: true },
          },
        },
      },
    },
  });

  const ids = items.map((x) => x.id);
  const commentsGrouped = ids.length
    ? await prisma.comment.groupBy({
        by: ["articleId"],
        where: { articleId: { in: ids }, status: "PUBLISHED" },
        _count: { articleId: true },
      })
    : [];
  const commentsById = new Map<string, number>(commentsGrouped.map((g) => [g.articleId, g._count.articleId]));

  const qs = (p: number, l: number = perPage) =>
    `?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(sectionSlug ? { section: sectionSlug } : {}),
      ...(tagSlug ? { tag: tagSlug } : {}),
      ...(authorSlug ? { author: authorSlug } : {}),
      ...(fromStr ? { from: fromStr } : {}),
      ...(toStr ? { to: toStr } : {}),
      page: String(p),
      limit: String(l),
    }).toString()}`;

  const pageNums = getPageNumbers(currentPage, totalPages);

  const fullName = (a: { lastName: string; firstName: string; patronymic: string }) =>
    `${a.lastName} ${a.firstName} ${a.patronymic}`.trim();

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-6">
      <form
        action="/search"
        method="GET"
        className="mt-4 grid gap-3 rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200 sm:[grid-template-columns:repeat(5,minmax(0,1fr))_auto]"
      >
        <div>
          <label className="mb-1 block text-xs text-neutral-600">Название</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Поиск по заголовку…"
            className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-600">Раздел</label>
          <select
            name="section"
            defaultValue={sectionSlug}
            className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          >
            <option value="">Все разделы</option>
            {sections.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-600">Тег</label>
          <select
            name="tag"
            defaultValue={tagSlug}
            className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          >
            <option value="">Все теги</option>
            {tags.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-600">Автор</label>
          <select
            name="author"
            defaultValue={authorSlug}
            className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          >
            <option value="">Все авторы</option>
            {authors.map((a) => (
              <option key={a.slug} value={a.slug}>{fullName(a)}</option>
            ))}
          </select>
        </div>

        <DateRangeInput
          className=""
          inputClassName=""
          label="Дата"
          from={fromStr}
          to={toStr}
          nameFrom="from"
          nameTo="to"
          placeholder="Выберите дату или период"
        />

        <div className="flex items-end justify-end gap-2">
          <button type="submit" className="rounded-lg bg-neutral-900 px-3 py-2 text-white transition hover:bg-neutral-800">
            Применить
          </button>
          {(q || sectionSlug || tagSlug || authorSlug || fromStr || toStr) && (
            <Link href="/search" className="rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 transition hover:bg-neutral-100">
              Сбросить
            </Link>
          )}
        </div>
      </form>

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
            authors={a.authors.map((x) => ({
              id: x.author.id,
              slug: x.author.slug,
              firstName: x.author.firstName,
              lastName: x.author.lastName,
              patronymic: x.author.patronymic,
            }))}
            viewsCount={a.viewsCount ?? 0}
            commentsCount={commentsById.get(a.id) ?? 0}
          />
        ))}

        {items.length === 0 && (
          <div className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-700 ring-1 ring-neutral-200">
            Ничего не найдено.
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="mr-0 md:mr-6 flex items-center gap-2 text-sm shrink-0"></div>
          <nav className="flex basis-full flex-wrap items-center gap-1 sm:basis-auto">
            <Link
              href={qs(Math.max(1, currentPage - 1))}
              aria-disabled={currentPage === 1}
              className={`rounded-full px-2.5 py-1 text-sm ring-1 ring-neutral-300 ${currentPage === 1 ? "pointer-events-none opacity-40" : "hover:bg-neutral-100"}`}
            >
              ←
            </Link>

            {pageNums.map((n, i) =>
              n === -1 ? (
                <span key={`e${i}`} className="select-none px-2 text-neutral-500">…</span>
              ) : (
                <Link
                  key={n}
                  href={qs(n)}
                  className={`rounded-full px-2.5 py-1 text-sm ring-1 ring-neutral-300 ${n === currentPage ? "bg-neutral-900 text-white ring-neutral-900" : "hover:bg-neutral-100"}`}
                  aria-current={n === currentPage ? "page" : undefined}
                >
                  {n}
                </Link>
              )
            )}

            <Link
              href={qs(Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage === totalPages}
              className={`rounded-full px-2.5 py-1 text-sm ring-1 ring-neutral-300 ${currentPage === totalPages ? "pointer-events-none opacity-40" : "hover:bg-neutral-100"}`}
            >
              →
            </Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
