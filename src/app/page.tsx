export const dynamic = "force-dynamic";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { prisma } from "../../lib/db";
import InfiniteFeed from "./components/InfiniteFeed";
import AllNewsList from "./components/AllNewsList";
import HeroCarousel, { type HeroItem } from "./components/HeroCarousel";

export default async function HomePage() {
  const [sections, featuredRaw, discussRaw, feedStart] = await Promise.all([
    prisma.section.findMany({
      select: { slug: true, name: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),

    // 🔸 КАРУСЕЛЬ: отмеченные + опубликованные (+ окно показа)
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { not: null as any },
        inCarousel: true,
        OR: [{ carouselFrom: null }, { carouselFrom: { lte: new Date() } }],
        AND: [{ OR: [{ carouselTo: null }, { carouselTo: { gte: new Date() } }] }],
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        coverMedia: { select: { id: true } },
        section: { select: { slug: true, name: true } },
        tags: { include: { tag: true } },
      },
    }),

    // 🔸 Сейчас обсуждают — последние 3 по времени последнего комментария
    (async () => {
      // Группируем комментарии по статье:
      //  - считаем количество
      //  - берём максимальную дату createdAt
      //  - сортируем по _max.createdAt desc
      //  - берём топ-3
      const groups = await prisma.comment.groupBy({
        by: ["articleId"],
        where: { status: "PUBLISHED" },
        _count: { articleId: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
        take: 3,
      });

      const ids = groups.map((g) => g.articleId);
      if (ids.length === 0) return [] as Array<{ count: number; lastAt: Date | null; article: any }>;

      const arts = await prisma.article.findMany({
        where: { id: { in: ids }, status: "PUBLISHED" },
        select: {
          id: true,
          slug: true,
          title: true,
          section: { select: { slug: true, name: true } },
          tags: { include: { tag: true } },
        },
      });

      const map = new Map(arts.map((a) => [a.id, a]));
      // Сохраняем исходный порядок groups (уже отсортирован по последнему комменту)
      return groups
        .map((g) => ({
          count: g._count.articleId,
          lastAt: g._max.createdAt ?? null,
          article: map.get(g.articleId)!,
        }))
        .filter((x) => x.article);
    })(),

    // 🔸 Старт бесконечной ленты (без exclude)
    prisma.article.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null as any } },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        publishedAt: true,
        coverMedia: { select: { id: true } },
        section: { select: { slug: true, name: true } },
        tags: { include: { tag: true } },
        viewsCount: true,
      },
    }),
  ]);

  // 🔹 Считаем комментарии для стартовых карточек фида
  const feedIds = feedStart.map((r) => r.id);
  const feedCommentsGrouped = feedIds.length
    ? await prisma.comment.groupBy({
        by: ["articleId"],
        where: { articleId: { in: feedIds }, status: "PUBLISHED" },
        _count: { articleId: true },
      })
    : [];
  const feedCommentsById = new Map<string, number>(
    feedCommentsGrouped.map((g) => [g.articleId, g._count.articleId])
  );

  // ДАННЫЕ ДЛЯ КАРУСЕЛИ
  const heroItems: HeroItem[] = featuredRaw.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle ?? undefined,
    image: a.coverMedia?.id ? `/admin/media/${a.coverMedia.id}/raw` : null,
    section: { slug: a.section?.slug ?? null, name: a.section?.name ?? null },
    tags: a.tags.map((x) => ({ id: x.tag.id, slug: x.tag.slug, name: x.tag.name })),
  }));

  // Стартовые карточки
  const feedStartWithMeta = feedStart.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    publishedAt: r.publishedAt ?? undefined,
    coverId: r.coverMedia?.id ?? null,
    section: { slug: r.section?.slug ?? null, name: r.section?.name ?? null },
    tags: r.tags.map((x) => ({ id: x.tag.id, slug: x.tag.slug, name: x.tag.name })),
    commentsCount: feedCommentsById.get(r.id) ?? 0,
    viewsCount: r.viewsCount ?? 0,
  }));

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Левый столбец */}
        <AllNewsList />

        {/* Центр */}
        <div>
          {/* Полоса разделов */}
          <section className="mb-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to透明" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to透明" />
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-2">
                {sections.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/search?section=${encodeURIComponent(s.slug)}`}
                    className="whitespace-nowrap rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* HERO-карусель */}
          <section className="mb-8">
            {heroItems.length > 0 ? (
              <HeroCarousel items={heroItems} />
            ) : (
              <div className="rounded-2xl border p-6 text-center text-sm text-neutral-600">
                В карусели пока нет материалов. Отметьте опубликованные статьи в админке — и они появятся здесь.
              </div>
            )}
          </section>

          {/* Сейчас обсуждают — топ-3 по времени последнего комментария */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">Сейчас обсуждают</h2>
            <div className="space-y-2">
              {discussRaw.map((x) => (
                <Link
                  key={x.article.id}
                  href={`/news/${encodeURIComponent(x.article.slug)}`}
                  className="block rounded-lg border p-3 hover:bg-gray-50"
                >
                  <div className="text-sm font-medium leading-snug">{x.article.title}</div>
                  <div className="mt-1 text-xs text-neutral-600 flex flex-wrap items-center gap-2">
                    {x.article.section?.name && (
                      <span className="rounded border px-1 py-0.5">{x.article.section.name}</span>
                    )}
                    {x.article.tags?.map((t: { tag: { id: string; slug: string; name: string } }) => (
                      <span key={t.tag.id} className="rounded-full border px-2 py-0.5 text-[11px]">
                        #{t.tag.name}
                      </span>
                    ))}
                    <span className="ml-auto flex items-center gap-1 text-lg sm:text-xl font-semibold text-neutral-800" title="Количество комментариев">
                      💬 {x.count}
                    </span>
                  </div>
                </Link>
              ))}
              {discussRaw.length === 0 && (
                <div className="rounded-lg border p-4 text-center text-sm text-neutral-600">
                  Пока нет активных обсуждений.
                </div>
              )}
            </div>
          </section>

          {/* Бесконечная лента */}
          <section className="space-y-4">
            <InfiniteFeed initialItems={feedStartWithMeta} perPage={12} />
          </section>
        </div>
      </div>
    </main>
  );
}
