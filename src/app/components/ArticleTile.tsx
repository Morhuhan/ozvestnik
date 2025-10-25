import Link from "next/link";

type TagLite = { id: string; slug: string; name: string };
type SectionLite = { slug: string | null; name: string | null };
type AuthorLite = { id: string; slug: string; firstName: string; lastName: string; patronymic: string };

export type ArticleTileProps = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  publishedAt?: Date | null;
  coverId?: string | null;
  section?: SectionLite | null;
  tags?: TagLite[];
  authors?: AuthorLite[];
  commentsCount?: number;
  viewsCount?: number;
};

function publishedWhen(d?: Date | null) {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms < 2 * minute) return "только что";
  if (ms < hour) return `${Math.floor(ms / minute)} мин`;
  if (ms < day) return `${Math.floor(ms / hour)} ч`;
  const days = Math.floor(ms / day);
  if (days <= 10) return `${days} д`;
  return new Date(d).toLocaleDateString("ru-RU");
}

function formatCountRu(n?: number) {
  const v = Math.max(0, Number(n) || 0);
  if (v >= 1_000_000) return `${Math.floor(v / 1_000_000)}М`;
  if (v >= 1_000) return `${Math.floor(v / 1_000)}К`;
  return String(v);
}

function authorLine(arr: AuthorLite[] = []) {
  return arr.map(a => `${a.lastName} ${a.firstName} ${a.patronymic}`.trim()).join(", ");
}

export default function ArticleTile({
  slug,
  title,
  subtitle,
  publishedAt,
  coverId,
  section,
  tags = [],
  authors = [],
  commentsCount = 0,
  viewsCount = 0,
}: ArticleTileProps) {
  const mediaUrl = (id: string) => `/admin/media/${id}/raw`;

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-black/5 shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:shadow-md">
      <Link href={`/news/${encodeURIComponent(slug)}`} aria-label={title} className="absolute inset-0 z-10" />

      <div className="aspect-[16/9] bg-neutral-300">
        {coverId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(coverId)} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">без изображения</div>
        )}
      </div>

      <div className="pointer-events-none p-4 pb-10">
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

        {authors.length > 0 && (
          <div className="mt-1 text-[13px] text-neutral-700">
            {authorLine(authors)}
          </div>
        )}

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
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-neutral-100/95 backdrop-blur-[1px]">
        <div className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2 text-[12px] sm:text-[13px] leading-none text-neutral-700">
          {publishedAt && (
            <span className="shrink-0 font-medium" title={new Date(publishedAt).toLocaleString("ru-RU")}>
              {publishedWhen(publishedAt)}
            </span>
          )}
          <span className="select-none text-neutral-300">·</span>
          <span className="inline-flex items-center gap-1 font-semibold" aria-label={`${viewsCount} просмотров`} title="Просмотры">
            <span aria-hidden className="text-[16px] leading-none">👁️</span>
            <span>{formatCountRu(viewsCount)}</span>
          </span>
          <span className="select-none text-neutral-300">·</span>
          <span className="inline-flex items-center gap-1 font-semibold" aria-label={`${commentsCount} комментариев`} title="Комментарии">
            <span aria-hidden className="text-[16px] leading-none">💬</span>
            <span>{formatCountRu(commentsCount)}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
