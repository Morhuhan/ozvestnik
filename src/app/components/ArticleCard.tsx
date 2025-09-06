// app/components/ArticleCard.tsx

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

type TagLite = { id: string; slug: string; name: string };
type SectionLite = { slug: string | null; name: string | null };

export type ArticleCardProps = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
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
    ? new Date(publishedAt).toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" })
    : "";
  const leadText = subtitle ?? (showExcerpt ? excerpt ?? null : null);

  return (
    <article className="group cursor-pointer rounded-2xl bg-neutral-100 p-4 ring-1 ring-neutral-200 shadow-sm transition duration-200 hover:bg-neutral-200 hover:ring-neutral-300 hover:shadow-md sm:p-5">
      <div className="grid items-start gap-4 sm:grid-cols-[1fr_260px] md:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {section?.name ? (
              <Link
                href={`/search?section=${encodeURIComponent(section.slug || "")}`}
                className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-900"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-700" />
                {section.name}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                Без раздела
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold leading-snug text-neutral-900 sm:text-2xl">
            <Link href={`/news/${encodeURIComponent(slug)}`} className="hover:text-neutral-950">
              {title}
            </Link>
          </h2>

          {leadText && <p className="mt-2 text-[15px] leading-relaxed text-neutral-800">{leadText}</p>}

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/search?tag=${encodeURIComponent(t.slug)}`}
                  className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs text-neutral-700 ring-1 ring-neutral-300 transition-colors hover:bg-neutral-300"
                  title={`Искать по тегу ${t.name}`}
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs text-neutral-600">
            {dateStr && <span>{dateStr}</span>}
            <span className="inline-flex items-center gap-1" title="Комментарии">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
              {commentsCount}
            </span>
          </div>
        </div>

        <div className="order-first sm:order-none">
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-neutral-300">
            {coverId ? (
              <>
                <img src={mediaUrl(coverId)} alt="" className="h-full w-full object-cover transition duration-200 group-hover:brightness-90" loading="lazy" />
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-10 bg-black" />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">без изображения</div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
