/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { prisma } from "../../../lib/db";

function minutesAgo(date?: Date | null) {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diff < 60) return `${diff} мин назад`;
  const h = Math.floor(diff / 60);
  return `${h} ч назад`;
}

export default async function AllNewsList({
  limit = 50,
  className = "",
}: {
  limit?: number;
  className?: string;
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
        select: { media: { select: { kind: true, mime: true } } },
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
    <aside className={className}>
      <div className="overflow-hidden rounded-2xl border bg-white p-3">
        {/* кликабельная шапка */}
        <Link
          href="/search"
          className="mb-3 block rounded-xl border bg-blue-50 px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-blue-700 hover:bg-blue-100"
        >
          Все новости
        </Link>

        {/* список */}
        <ul className="divide-y rounded-xl border bg-white/60">
          {items.map((n) => {
            const showImg = hasImage(n);
            const showVid = hasVideo(n);
            return (
              <li key={n.id}>
                <Link
                  href={`/news/${encodeURIComponent(n.slug)}`}
                  className="block px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-start gap-2">
                    {/* эмодзи медиа (ничего не рендерим, если нет фото/видео) */}
                    {(showImg || showVid) && (
                      <span className="mt-0.5 shrink-0 text-base leading-none">
                        {showImg && (
                          <span title="Фото" aria-hidden className="mr-1">
                            🖼️
                          </span>
                        )}
                        {showVid && <span title="Видео" aria-hidden>📹</span>}
                      </span>
                    )}

                    {/* текст с переносами, чтобы не вылезал за рамки */}
                    <div className="min-w-0">
                      <div className="break-all text-sm leading-snug">
                        {n.title}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {minutesAgo(n.publishedAt)}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* нижняя кнопка */}
        <div className="mt-3">
          <Link
            href="/search"
            className="block w-full rounded-lg border px-3 py-2 text-center text-sm hover:bg-gray-50"
          >
            Все новости →
          </Link>
        </div>
      </div>
    </aside>
  );
}
