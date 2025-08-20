export const revalidate = 60;

import Link from "next/link";
import { prisma } from "../../lib/db";

// Тип для searchParams (в новых версиях Next стоит await'ить пропс)
type SP = { q?: string; section?: string; tag?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const sectionSlug = (sp.section || "").trim();
  const tagSlug = (sp.tag || "").trim();

  // Справочники для фильтров
  const [sections, tags] = await Promise.all([
    prisma.section.findMany({
      select: { slug: true, name: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.tag.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // WHERE-условия
  const where: any = { status: "PUBLISHED" };

  if (sectionSlug) {
    where.section = { slug: sectionSlug };
  }
  if (tagSlug) {
    where.tags = { some: { tag: { slug: tagSlug } } };
  }
  if (q) {
    // Простой поиск по заголовку/выдержке (можно расширить на content при желании)
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { excerpt: { contains: q, mode: "insensitive" } },
    ];
  }

  const articles = await prisma.article.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      section: { select: { name: true, slug: true } },
      tags: { include: { tag: true } },
      coverMedia: { select: { id: true } },
    },
  });

  const mediaUrl = (id: string) => `/admin/media/${id}/raw`;

  // Утилита для сборки URL текущей страницы с изменёнными параметрами
  function buildUrl(next: Partial<SP>) {
    const params = new URLSearchParams();
    const nextQ = next.q ?? q;
    const nextSection = next.section ?? sectionSlug;
    const nextTag = next.tag ?? tagSlug;

    if (nextQ) params.set("q", nextQ);
    if (nextSection) params.set("section", nextSection);
    if (nextTag) params.set("tag", nextTag);

    const qs = params.toString();
    return qs ? `/?${qs}` : `/`;
    // (если у тебя главная не на '/', замени здесь базовый путь)
  }

  return (
    <main className="container mx-auto p-4 max-w-5xl">
      <h1 className="text-2xl font-bold mb-4">Свежие новости</h1>

      {/* Панель фильтров */}
      <form action="/" method="GET" className="mb-6 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs mb-1 opacity-70">Поиск</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Заголовок или описание…"
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-xs mb-1 opacity-70">Раздел</label>
          <select
            name="section"
            defaultValue={sectionSlug}
            className="w-full border rounded p-2"
          >
            <option value="">Все разделы</option>
            {sections.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1 opacity-70">Тег</label>
          <select
            name="tag"
            defaultValue={tagSlug}
            className="w-full border rounded p-2"
          >
            <option value="">Все теги</option>
            {tags.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3 flex items-center gap-2">
          <button
            type="submit"
            className="px-3 py-2 rounded bg-black text-white hover:bg-gray-800"
          >
            Применить
          </button>

          {(q || sectionSlug || tagSlug) && (
            <Link
              href="/"
              className="px-3 py-2 rounded border hover:bg-gray-50"
              title="Сбросить все фильтры"
            >
              Сбросить
            </Link>
          )}
        </div>
      </form>

      {/* Выбранные фильтры (чипсы) */}
      {(q || sectionSlug || tagSlug) && (
        <div className="mb-4 text-sm flex flex-wrap gap-2">
          {q && (
            <span className="inline-flex items-center gap-2 border rounded px-2 py-1">
              Поиск: <b className="font-medium">{q}</b>
              <Link
                href={buildUrl({ q: "" })}
                className="text-xs underline"
                title="Убрать поиск"
              >
                ×
              </Link>
            </span>
          )}
          {sectionSlug && (
            <span className="inline-flex items-center gap-2 border rounded px-2 py-1">
              Раздел: <b className="font-medium">
                {sections.find((s) => s.slug === sectionSlug)?.name || sectionSlug}
              </b>
              <Link
                href={buildUrl({ section: "" })}
                className="text-xs underline"
                title="Убрать раздел"
              >
                ×
              </Link>
            </span>
          )}
          {tagSlug && (
            <span className="inline-flex items-center gap-2 border rounded px-2 py-1">
              Тег: <b className="font-medium">
                {tags.find((t) => t.slug === tagSlug)?.name || tagSlug}
              </b>
              <Link
                href={buildUrl({ tag: "" })}
                className="text-xs underline"
                title="Убрать тег"
              >
                ×
              </Link>
            </span>
          )}
        </div>
      )}

      {/* Лента статей */}
      <div className="space-y-6">
        {articles.map((a) => {
          const coverId = a.coverMedia?.id;
          return (
            <article key={a.id} className="border rounded p-4">
              <div className="flex gap-4">
                {/* Превью обложки (если есть) */}
                {coverId ? (
                  <div className="w-40 shrink-0">
                    <div className="aspect-video rounded overflow-hidden bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaUrl(coverId)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex-1 min-w-0">
                  <div className="text-xs opacity-70 mb-1">
                    {/* Клик по разделу теперь фильтрует главную */}
                    <Link
                      href={buildUrl({ section: a.section?.slug || "" })}
                      className="underline decoration-dotted"
                    >
                      {a.section?.name ?? "Без раздела"}
                    </Link>
                    {" • "}
                    {a.publishedAt
                      ? new Date(a.publishedAt).toLocaleDateString("ru-RU")
                      : ""}
                  </div>

                  <h2 className="text-xl font-semibold">
                    <Link
                      href={`/news/${encodeURIComponent(a.slug)}`}
                      className="hover:underline"
                    >
                      {a.title}
                    </Link>
                  </h2>

                  {a.excerpt && (
                    <p className="mt-2 text-sm text-neutral-700 line-clamp-3">
                      {a.excerpt}
                    </p>
                  )}

                  {a.tags.length > 0 && (
                    <div className="mt-3 text-xs flex flex-wrap gap-2">
                      {a.tags.map((t) => (
                        <Link
                          key={t.tagId}
                          href={buildUrl({ tag: t.tag.slug })}
                          className="px-2 py-1 rounded border hover:bg-gray-50"
                          title={`Показать статьи с тегом ${t.tag.name}`}
                        >
                          #{t.tag.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {articles.length === 0 && (
          <div className="opacity-60">По выбранным фильтрам ничего не найдено.</div>
        )}
      </div>
    </main>
  );
}
