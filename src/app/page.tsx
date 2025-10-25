export const dynamic = "force-dynamic";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "../../lib/db";
import InfiniteFeed from "./components/InfiniteFeed";
import AllNewsList from "./components/AllNewsList";
import HeroCarousel, { type HeroItem } from "./components/HeroCarousel";
import PopularSections from "./components/PopularSections";

export default async function HomePage() {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const isMobile = /(Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini|Mobile)/i.test(ua);

  const [sections, featuredRaw, discussRaw, feedStart] = await Promise.all([
    prisma.section.findMany({
      select: { slug: true, name: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
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
        id: true, slug: true, title: true, subtitle: true,
        coverMedia: { select: { id: true } },
        section: { select: { slug: true, name: true } },
        tags: { include: { tag: true } },
      },
    }),
    (async () => {
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
          id: true, slug: true, title: true,
          section: { select: { slug: true, name: true } },
          tags: { include: { tag: true } },
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
      const map = new Map(arts.map((a) => [a.id, a]));
      return groups
        .map((g) => ({ count: g._count.articleId, lastAt: g._max.createdAt ?? null, article: map.get(g.articleId)! }))
        .filter((x) => x.article);
    })(),
    prisma.article.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null as any } },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true, slug: true, title: true, subtitle: true, publishedAt: true,
        coverMedia: { select: { id: true } },
        section: { select: { slug: true, name: true } },
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
    }),
  ]);

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

  const heroItems: HeroItem[] = featuredRaw.map((a) => ({
    id: a.id, slug: a.slug, title: a.title, subtitle: a.subtitle ?? undefined,
    image: a.coverMedia?.id ? `/admin/media/${a.coverMedia.id}/raw` : null,
    section: { slug: a.section?.slug ?? null, name: a.section?.name ?? null },
    tags: a.tags.map((x) => ({ id: x.tag.id, slug: x.tag.slug, name: x.tag.name })),
  }));

  const feedStartWithMeta = feedStart.map((r) => ({
    id: r.id, slug: r.slug, title: r.title, subtitle: r.subtitle,
    publishedAt: r.publishedAt ?? undefined, coverId: r.coverMedia?.id ?? null,
    section: { slug: r.section?.slug ?? null, name: r.section?.name ?? null },
    tags: r.tags.map((x) => ({ id: x.tag.id, slug: x.tag.slug, name: x.tag.name })),
    authors: r.authors.map((x) => ({
      id: x.author.id,
      slug: x.author.slug,
      firstName: x.author.firstName,
      lastName: x.author.lastName,
      patronymic: x.author.patronymic,
    })),
    commentsCount: feedCommentsById.get(r.id) ?? 0, viewsCount: r.viewsCount ?? 0,
  }));

  const authorLine = (arr: { author: { firstName: string; lastName: string; patronymic: string } }[]) =>
    arr.map(a => `${a.author.lastName} ${a.author.firstName} ${a.author.patronymic}`.trim()).join(", ");

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        {!isMobile && <AllNewsList className="self-start hidden lg:block" />}

        <div>
          <section className="mb-6">
            <PopularSections />
          </section>

          <section className="mb-10">
            {heroItems.length > 0 ? (
              <HeroCarousel items={heroItems} />
            ) : (
              <div className="rounded-2xl bg-neutral-50 p-6 text-center text-sm text-neutral-600 ring-1 ring-black/5">
                В карусели пока нет материалов. Отметьте опубликованные статьи в админке — и они появятся здесь.
              </div>
            )}
          </section>

          <section className="mb-8">
            <div className="space-y-2">
              {discussRaw.map((x) => (
                <Link
                  key={x.article.id}
                  href={`/news/${encodeURIComponent(x.article.slug)}`}
                  className="block rounded-xl bg-neutral-100 p-4 ring-1 ring-neutral-200 transition-all hover:bg-neutral-200 hover:ring-neutral-300 hover:shadow-md"
                >
                  <div className="text-sm font-medium leading-snug text-neutral-900">
                    {x.article.title}
                  </div>
                  <div className="mt-1 text-[12px] text-neutral-700">
                    {x.article.authors?.length ? authorLine(x.article.authors as any) : ""}
                  </div>
                  <div className="mt-2 text-xs text-neutral-700 flex flex-wrap items-center gap-2">
                    {x.article.section?.name && (
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 ring-1 ring-neutral-300">
                        {x.article.section.name}
                      </span>
                    )}
                    {x.article.tags?.map((t: { tag: { id: string; slug: string; name: string } }) => (
                      <span key={t.tag.id} className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] ring-1 ring-neutral-300">
                        #{t.tag.name}
                      </span>
                    ))}
                    <span className="ml-auto flex items-center gap-1 text-lg sm:text-xl font-semibold text-neutral-900" title="Количество комментариев">
                      💬 {x.count}
                    </span>
                  </div>
                </Link>
              ))}
              {discussRaw.length === 0 && (
                <div className="rounded-xl bg-neutral-100 p-5 text-center text-sm text-neutral-700 ring-1 ring-neutral-200">
                  Пока нет активных обсуждений.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <InfiniteFeed initialItems={feedStartWithMeta} perPage={12} />
          </section>
        </div>
      </div>
    </main>
  );
}
