//C:\Users\radio\Projects\ozerskiy-vestnik\src\app\components\ArticleCard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMediaUrl } from "../../../lib/media";

type TagLite = { id: string; slug: string; name: string };
type SectionLite = { slug: string | null; name: string | null };
type AuthorLite = { id: string; slug: string; firstName: string; lastName: string; patronymic: string };

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
  authors?: AuthorLite[];
  coverId?: string | null;
  commentsCount?: number;
  viewsCount?: number;
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
  authors = [],
  coverId,
  commentsCount = 0,
  viewsCount = 0,
}: ArticleCardProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" })
    : "";
  const leadText = subtitle ?? (showExcerpt ? excerpt ?? null : null);

  const goToArticle = () => router.push(`/news/${encodeURIComponent(slug)}`);
  const onKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToArticle();
    }
  };

  const fullName = (a: AuthorLite) => `${a.lastName} ${a.firstName} ${a.patronymic}`.trim();

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Открыть статью: ${title}`}
      onClick={goToArticle}
      onKeyDown={onKey}
      className="group cursor-pointer rounded-2xl bg-neutral-100 p-4 ring-1 ring-neutral-200 shadow-sm transition duration-200 hover:bg-neutral-200 hover:ring-neutral-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-neutral-600 sm:p-5"
    >
      <div className="grid items-start gap-4 sm:grid-cols-[1fr_260px] md:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {section?.name ? (
              <span className="inline-flex items-center gap-1 text-neutral-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-700" />
                {section.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                Без раздела
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold leading-snug text-neutral-900 sm:text-2xl">
            <span className="hover:text-neutral-950">{title}</span>
          </h2>

          {authors.length > 0 && (
            <div className="mt-1 text-[13px] text-neutral-700">
              {authors.map((a, i) => (
                <span key={a.id}>
                  {i > 0 ? ", " : ""}
                  {fullName(a)}
                </span>
              ))}
            </div>
          )}

          {leadText && <p className="mt-2 text-[15px] leading-relaxed text-neutral-800">{leadText}</p>}

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs text-neutral-700 ring-1 ring-neutral-300"
                  title={`Тег: ${t.name}`}
                >
                  #{t.name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs text-neutral-600">
            {dateStr && <span>{dateStr}</span>}
            <span className="inline-flex items-center gap-1" title="Просмотры" aria-label={`${viewsCount} просмотров`}>
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {viewsCount}
            </span>
            <span className="inline-flex items-center gap-1" title="Комментарии" aria-label={`${commentsCount} комментариев`}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
                <img
                  src={imgError ? getMediaUrl(coverId) : getMediaUrl(coverId, "M")}
                  alt=""
                  className="h-full w-full object-cover transition duration-200 group-hover:brightness-90"
                  loading="lazy"
                  decoding="async"
                  onError={() => setImgError(true)}
                />
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