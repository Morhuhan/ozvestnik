export const dynamic = "force-dynamic";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "../../lib/db";
import InfiniteFeed from "./components/InfiniteFeed";
import AllNewsList from "./components/AllNewsList";
import HeroCarousel, { type HeroItem } from "./components/HeroCarousel";
import PopularSections from "./components/PopularSections";
import ConfirmRegistration from "./components/ConfirmRegistration";

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
        id: true,
        slug: true,
        title: true,
        subtitle: true,
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
          id: true,
          slug: true,
          title: true,
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
        .map((g) => ({
          count: g._count.articleId,
          lastAt: g._max.createdAt ?? null,
          article: map.get(g.articleId)!,
        }))
        .filter((x) => x.article);
    })(),
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
    id: a.id,
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle ?? undefined,
    image: a.coverMedia?.id ? `/admin/media/${a.coverMedia.id}/raw` : null,
    section: { slug: a.section?.slug ?? null, name: a.section?.name ?? null },
    tags: a.tags.map((x) => ({ id: x.tag.id, slug: x.tag.slug, name: x.tag.name })),
  }));

  const feedStartWithMeta = feedStart.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    publishedAt: r.publishedAt ?? undefined,
    coverId: r.coverMedia?.id ?? null,
    section: { slug: r.section?.slug ?? null, name: r.section?.name ?? null },
    tags: r.tags.map((x) => ({ id: x.tag.id, slug: x.tag.slug, name: x.tag.name })),
    authors: r.authors.map((x) => ({
      id: x.author.id,
      slug: x.author.slug,
      firstName: x.author.firstName,
      lastName: x.author.lastName,
      patronymic: x.author.patronymic,
    })),
    commentsCount: feedCommentsById.get(r.id) ?? 0,
    viewsCount: r.viewsCount ?? 0,
  }));

  const authorLine = (
    arr: { author: { firstName: string; lastName: string; patronymic: string } }[]
  ) =>
    arr
      .map((a) => `${a.author.lastName} ${a.author.firstName} ${a.author.patronymic}`.trim())
      .join(", ");

  return (
    <>
      <ConfirmRegistration />
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto w-full max-w-[1720px] px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
            {!isMobile && <AllNewsList className="self-start hidden lg:block" />}

            <div className="space-y-4 sm:space-y-6">
              <section>
                <PopularSections />
              </section>

              <section>
                {heroItems.length > 0 ? (
                  <HeroCarousel items={heroItems} />
                ) : (
                  <div className="rounded-xl sm:rounded-2xl bg-white border border-gray-200 p-4 sm:p-6 text-center text-sm text-gray-600 shadow-sm">
                    В карусели пока нет материалов. Отметьте опубликованные статьи в админке — и они появятся здесь.
                  </div>
                )}
              </section>

              {discussRaw.length > 0 && (
                <section>
                  <div className="mb-3 sm:mb-4">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                      <span className="text-xl sm:text-2xl">💬</span>
                      Обсуждаемое
                    </h2>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {discussRaw.map((x) => (
                      <Link
                        key={x.article.id}
                        href={`/news/${encodeURIComponent(x.article.slug)}`}
                        className="block rounded-xl bg-white border border-gray-200 p-3 sm:p-4 shadow-sm transition-all hover:shadow-md hover:border-gray-300 active:scale-[0.98]"
                      >
                        <div className="text-sm sm:text-base font-semibold leading-snug text-gray-900 line-clamp-2">
                          {x.article.title}
                        </div>
                        {x.article.authors?.length > 0 && (
                          <div className="mt-1.5 text-xs sm:text-sm text-gray-600">
                            {authorLine(x.article.authors as any)}
                          </div>
                        )}
                        <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                          {x.article.section?.name && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium border border-blue-200">
                              {x.article.section.name}
                            </span>
                          )}
                          {x.article.tags?.slice(0, 2).map((t: { tag: { id: string; slug: string; name: string } }) => (
                            <span
                              key={t.tag.id}
                              className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium border border-gray-200"
                            >
                              #{t.tag.name}
                            </span>
                          ))}
                          <span
                            className="ml-auto flex items-center gap-1 text-base sm:text-lg font-bold text-gray-900"
                            title="Количество комментариев"
                          >
                            💬 <span className="text-sm sm:text-base">{x.count}</span>
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="mb-3 sm:mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Последние новости</h2>
                </div>
                <InfiniteFeed initialItems={feedStartWithMeta} perPage={12} />
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
