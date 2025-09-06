/* components/ArticleTile.tsx */

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
    <article className="group relative overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-black/5 shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:shadow-md">
      <Link href={`/news/${encodeURIComponent(slug)}`} aria-label={title} className="absolute inset-0 z-10" />
      <div className="pointer-events-none relative z-20">
        <div className="aspect-[16/9] bg-neutral-300">
          {coverId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(coverId)} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">без изображения</div>
          )}
        </div>

        <div className="p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {section?.name ? (
              <Link
                href={`/search?section=${encodeURIComponent(section.slug || "")}`}
                className="pointer-events-auto inline-flex items-center gap-2 hover:text-neutral-800"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-600" />
                {section.name}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                Без раздела
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold leading-snug text-neutral-900">
            <span className="pointer-events-none group-hover:text-neutral-950">{title}</span>
          </h3>

          {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-neutral-700 line-clamp-3">{subtitle}</p>}

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/search?tag=${encodeURIComponent(t.slug)}`}
                  className="pointer-events-auto rounded-full bg-neutral-200 px-2.5 py-1 text-xs text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-300"
                  title={`Статьи с тегом ${t.name}`}
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3 text-xs text-neutral-600">
            {publishedAt && <span title={new Date(publishedAt).toLocaleString("ru-RU")}>{timeAgoRu(publishedAt)}</span>}
            <span className="select-none text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1.5 font-medium" aria-label={`${viewsCount} просмотров`} title="Просмотры">
              <span aria-hidden className="text-base leading-none">👁️</span>
              <span>{viewsCount}</span>
            </span>
            <span className="select-none text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1.5 font-medium" aria-label={`${commentsCount} комментариев`} title="Комментарии">
              <span aria-hidden className="text-base leading-none">💬</span>
              <span>{commentsCount}</span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
