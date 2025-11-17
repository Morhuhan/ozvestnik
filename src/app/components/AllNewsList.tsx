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
        select: { media: { select: { kind: true, mime: true } } },
        take: 20,
      },
    },
  });

  return (
    <aside className={`h-full ${className}`}>
      <div className="flex h-full flex-col bg-gradient-to-b from-gray-100 to-gray-50">
        <ul className="flex-1 divide-y divide-gray-200 p-3">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={`/news/${encodeURIComponent(n.slug)}`}
                className="block rounded-lg px-3 py-2.5 transition-all hover:bg-white hover:shadow-sm"
              >
                <div className="min-w-0">
                  <div className="break-words text-sm font-medium leading-snug text-gray-900">
                    {n.title}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {publishedWhen(n.publishedAt)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}