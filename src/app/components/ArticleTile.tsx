/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

type TagLite = { id: string; slug: string; name: string };
type SectionLite = { slug: string | null; name: string | null };

export type ArticleTileProps = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  publishedAt?: Date | null;
  coverId?: string | null;
  section?: SectionLite | null;
  tags?: TagLite[];
  commentsCount?: number;
  /** новое: количество просмотров */
  viewsCount?: number;
};

function timeAgoRu(d?: Date | null) {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  const days = Math.floor(h / 24);
  return `${days} д`;
}

export default function ArticleTile({
  slug,
  title,
  subtitle,
  publishedAt,
  coverId,
  section,
  tags = [],
  commentsCount = 0,
  viewsCount = 0,
}: ArticleTileProps) {
  const mediaUrl = (id: string) => `/admin/media/${id}/raw`;
  return (
    <article className="overflow-hidden rounded-2xl border bg-white">
      {/* Картинка сверху */}
      <Link href={`/news/${encodeURIComponent(slug)}`} className="block">
        <div className="aspect-[16/9] bg-gray-100">
          {coverId ? (
            <img
              src={mediaUrl(coverId)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
              без изображения
            </div>
          )}
        </div>
      </Link>

      {/* Тело */}
      <div className="p-4">
        {/* Секция */}
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {section?.name ? (
            <Link
              href={`/search?section=${encodeURIComponent(section.slug || "")}`}
              className="inline-flex items-center gap-2 hover:text-blue-700"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-600" />
              {section.name}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
              Без раздела
            </span>
          )}
        </div>

        {/* Заголовок */}
        <h3 className="text-lg font-bold leading-snug">
          <Link
            href={`/news/${encodeURIComponent(slug)}`}
            className="text-blue-700 hover:underline"
          >
            {title}
          </Link>
        </h3>

        {/* Подзаголовок */}
        {subtitle && (
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-800 line-clamp-3">
            {subtitle}
          </p>
        )}

        {/* Теги (чипсы) */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link
                key={t.id}
                href={`/search?tag=${encodeURIComponent(t.slug)}`}
                className="rounded-full border px-2.5 py-1 text-xs hover:bg-gray-50"
                title={`Статьи с тегом ${t.name}`}
              >
                #{t.name}
              </Link>
            ))}
          </div>
        )}

        {/* Мета: время · 👁️ просмотры · 💬 комментарии */}
        <div className="mt-3 flex items-center gap-3 text-xs text-neutral-600">
          {publishedAt && <span title={new Date(publishedAt).toLocaleString("ru-RU")}>{timeAgoRu(publishedAt)}</span>}
          <span className="select-none text-neutral-300">·</span>
          <span
            className="ml-0 inline-flex items-center gap-1.5 font-medium text-neutral-700"
            aria-label={`${viewsCount} просмотров`}
            title="Просмотры"
          >
            <span aria-hidden className="text-base leading-none">👁️</span>
            <span>{viewsCount}</span>
          </span>
          <span className="select-none text-neutral-300">·</span>
          <span
            className="inline-flex items-center gap-1.5 font-medium text-neutral-700"
            aria-label={`${commentsCount} комментариев`}
            title="Комментарии"
          >
            <span aria-hidden className="text-base leading-none">💬</span>
            <span>{commentsCount}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
