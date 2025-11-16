/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { prisma } from "../../../lib/db";

function publishedWhen(date?: Date | null) {
  if (!date) return "";
  const ms = Date.now() - new Date(date).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (ms < 2 * minute) return "только что";
  if (ms < hour) {
    const m = Math.floor(ms / minute);
    return `${m} мин назад`;
  }
  if (ms < day) {
    const h = Math.floor(ms / hour);
    return `${h} ч назад`;
  }

  const days = Math.floor(ms / day);
  if (days <= 10) return `${days} д назад`;

  return new Date(date).toLocaleDateString("ru-RU");
}

export default async function AllNewsList({
  limit = 50,
  className = "",
  inMobileMenu = false,
}: {
  limit?: number;
  className?: string;
  inMobileMenu?: boolean;
}) {
  const take = Math.min(50, Math.max(1, limit));

  const items = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      slug: true,
      title: true,
      publishedAt: true,
      coverMedia: { select: { kind: true, mime: true } },
      media: {
        select: { media: { select: { kind: true, mime: true} } },
        take: 20,
      },
    },
  });

  type Row = (typeof items)[number];
  const hasVideo = (a: Row) =>
    (a.coverMedia?.kind === "VIDEO" ||
      (a.coverMedia?.mime ?? "").toLowerCase().startsWith("video/")) ||
    a.media.some(
      (m) =>
        m.media.kind === "VIDEO" ||
        (m.media.mime ?? "").toLowerCase().startsWith("video/")
    );

  const hasImage = (a: Row) =>
    (a.coverMedia?.kind === "IMAGE" ||
      (a.coverMedia?.mime ?? "").toLowerCase().startsWith("image/")) ||
    a.media.some(
      (m) =>
        m.media.kind === "IMAGE" ||
        (m.media.mime ?? "").toLowerCase().startsWith("image/")
    );

  return (
    <aside className={`h-full ${className}`}>
      <div className="h-full bg-neutral-100">
        <ul className="divide-y divide-neutral-200">
          {items.map((n) => {
            const showImg = hasImage(n);
            const showVid = hasVideo(n);
            return (
              <li key={n.id}>
                <Link
                  href={`/news/${encodeURIComponent(n.slug)}`}
                  className="block px-4 py-3 transition-all hover:bg-neutral-200 hover:shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    {(showImg || showVid) && (
                      <span className="mt-0.5 shrink-0 text-base leading-none text-neutral-700">
                        {showImg && (
                          <span title="Фото" aria-hidden className="mr-1">
                            🖼️
                          </span>
                        )}
                        {showVid && <span title="Видео" aria-hidden>📹</span>}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="break-words text-sm leading-snug text-neutral-900">
                        {n.title}
                      </div>
                      <div className="mt-1 text-xs text-neutral-600">
                        {publishedWhen(n.publishedAt)}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-neutral-200 p-3">
          <Link
            href="/search"
            data-close-menu={inMobileMenu ? "true" : undefined}
            className="block w-full rounded-lg bg-neutral-200 px-3 py-2 text-center text-sm text-neutral-900 ring-1 ring-neutral-300 transition-colors hover:bg-neutral-300"
          >
            Все новости →
          </Link>
        </div>
      </div>
    </aside>
  );
}