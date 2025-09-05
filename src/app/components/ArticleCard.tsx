/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

type TagLite = { id: string; slug: string; name: string };
type SectionLite = { slug: string | null; name: string | null };

export type ArticleCardProps = {
  id: string;
  slug: string;
  title: string;

  // новое: подзаголовок
  subtitle?: string | null;

  // выдержка опциональна и по умолчанию НЕ показывается
  excerpt?: string | null;
  showExcerpt?: boolean;

  publishedAt?: Date | null;
  section?: SectionLite | null;
  tags?: TagLite[];
  coverId?: string | null;
  commentsCount?: number;
};

export default function ArticleCard({
  slug,
  title,
  subtitle,
  excerpt,
  showExcerpt = false,
  publishedAt,
  section,
  tags = [],
  coverId,
  commentsCount = 0,
}: ArticleCardProps) {
  const mediaUrl = (id: string) => `/admin/media/${id}/raw`;
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleString("ru-RU", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "";

  // показываем подзаголовок; если его нет — по желанию выдержку
  const leadText = subtitle ?? (showExcerpt ? excerpt ?? null : null);

  return (
    <article className="rounded-2xl border bg-white p-4 sm:p-5">
      <div className="grid items-start gap-4 sm:grid-cols-[1fr_260px] md:grid-cols-[1fr_300px]">
        {/* Левая часть */}
        <div className="min-w-0">
          {/* Секция */}
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {section?.name ? (
              <Link
                href={`/search?q=${encodeURIComponent(section.name)}`}
                className="inline-flex items-center gap-1 text-neutral-600 hover:text-blue-700"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-600" />
                {section.name}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                Без раздела
              </span>
            )}
          </div>

          {/* Заголовок */}
          <h2 className="text-xl font-bold leading-snug sm:text-2xl">
            <Link
              href={`/news/${encodeURIComponent(slug)}`}
              className="text-blue-700 hover:underline"
            >
              {title}
            </Link>
          </h2>

          {/* Подзаголовок / выдержка */}
          {leadText && (
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-800">
              {leadText}
            </p>
          )}

          {/* Теги */}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/search?q=${encodeURIComponent(t.name)}`}
                  className="rounded-full border px-2.5 py-1 text-xs hover:bg-gray-50"
                  title={`Искать по тегу ${t.name}`}
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          )}

          {/* Мета-низ */}
          <div className="mt-4 flex items-center gap-4 text-xs text-neutral-600">
            {dateStr && <span>{dateStr}</span>}
            <span className="inline-flex items-center gap-1">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
              {commentsCount}
            </span>
          </div>
        </div>

        {/* Превью справа */}
        <div className="order-first sm:order-none">
          <div className="aspect-[16/10] overflow-hidden rounded-xl bg-gray-100">
            {coverId ? (
              <img
                src={mediaUrl(coverId)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                без изображения
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
