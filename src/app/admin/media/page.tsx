// src/app/admin/media/page.tsx
import Link from "next/link";
import { prisma } from "../../../../lib/db";
import { requireRole } from "../../../../lib/session";
import MediaGrid from "../components/MediaGrid";
import { acceptForKinds, IMAGE_EXT, IMAGE_MIME, VIDEO_EXT, VIDEO_MIME } from "../../../../lib/media";
import UploadForm from "../components/UploadForm";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const { page: rawPage, limit: rawLimit } = await searchParams;

  const PER_PAGE_OPTIONS = [12, 24, 48, 96] as const;
  const DEFAULT_LIMIT = 24;

  const limitParsed = Number(rawLimit);
  const perPage = PER_PAGE_OPTIONS.includes(limitParsed as any)
    ? (limitParsed as (typeof PER_PAGE_OPTIONS)[number])
    : DEFAULT_LIMIT;

  const pageParsed = Number(rawPage);
  const page = Number.isFinite(pageParsed) && pageParsed > 0 ? Math.floor(pageParsed) : 1;

  const total = await prisma.mediaAsset.count();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * perPage;

  const assets = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    skip,
    take: perPage,
    select: {
      id: true,
      kind: true,
      mime: true,
      filename: true,
      title: true,
      alt: true,
      createdAt: true,
    },
  });

  // helper для ссылок
  const qs = (p: number, l = perPage) =>
    `?${new URLSearchParams({ page: String(p), limit: String(l) }).toString()}`;

  const pageNums = getPageNumbers(currentPage, totalPages);

  const allowedMimes = [...IMAGE_MIME, ...VIDEO_MIME];
  const allowedExts = [...IMAGE_EXT, ...VIDEO_EXT];
  const accept = acceptForKinds(["IMAGE", "VIDEO"]);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 sm:px-8 lg:px-12 py-8">
      {/* Верхняя панель */}
      <section className="rounded-2xl bg-white ring-1 ring-black/10 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Медиа-библиотека</h1>
            <p className="mt-1 text-sm text-neutral-600">Всего файлов: {total}</p>
          </div>

          {/* выбор "показывать по" — без JS, просто ссылки */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-600">Показывать по:</span>
            <div className="flex overflow-hidden rounded-full ring-1 ring-neutral-300 bg-white">
              {PER_PAGE_OPTIONS.map((n) => (
                <Link
                  key={n}
                  href={qs(1, n)}
                  className={
                    "px-3 py-1.5 transition " +
                    (n === perPage
                      ? "bg-neutral-900 text-white"
                      : "hover:bg-neutral-100 text-neutral-900")
                  }
                  aria-current={n === perPage ? "page" : undefined}
                >
                  {n}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Форма загрузки */}
        <div className="mt-6">
          <UploadForm
            action="/api/admin/media/upload"
            accept={accept}
            allowedMimes={allowedMimes}
            allowedExts={allowedExts}
          />
        </div>
      </section>

      {/* Сетка медиа */}
      <section className="mt-6 rounded-2xl bg-white ring-1 ring-black/10 shadow-sm p-4 sm:p-5">
        <MediaGrid assets={assets as any} />
      </section>

      {/* Пагинация */}
      <section className="mt-6 rounded-2xl bg-white ring-1 ring-black/10 shadow-sm p-4">
        <div className="flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div className="text-sm text-neutral-600">
            Стр. {currentPage} из {totalPages}
          </div>

          <nav className="flex items-center gap-1.5">
            <Link
              href={qs(Math.max(1, currentPage - 1))}
              aria-disabled={currentPage === 1}
              className={`rounded-full px-3.5 py-2 ring-1 ring-neutral-300 ${
                currentPage === 1 ? "pointer-events-none opacity-40" : "hover:bg-neutral-100"
              }`}
            >
              ←
            </Link>

            {pageNums.map((n, i) =>
              n === -1 ? (
                <span key={`e${i}`} className="select-none px-2 text-neutral-500">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={qs(n)}
                  className={`rounded-full px-3.5 py-2 ring-1 ring-neutral-300 ${
                    n === currentPage ? "bg-neutral-900 text-white ring-neutral-900" : "hover:bg-neutral-100"
                  }`}
                  aria-current={n === currentPage ? "page" : undefined}
                >
                  {n}
                </Link>
              )
            )}

            <Link
              href={qs(Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage === totalPages}
              className={`rounded-full px-3.5 py-2 ring-1 ring-neutral-300 ${
                currentPage === totalPages ? "pointer-events-none opacity-40" : "hover:bg-neutral-100"
              }`}
            >
              →
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}

function getPageNumbers(page: number, total: number): (number | -1)[] {
  const max = 7;
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const res: (number | -1)[] = [];
  const pushRange = (a: number, b: number) => { for (let i = a; i <= b; i++) res.push(i); };
  res.push(1);
  const left = Math.max(2, page - 1);
  const right = Math.min(total - 1, page + 1);
  if (left > 2) res.push(-1);
  pushRange(left, right);
  if (right < total - 1) res.push(-1);
  res.push(total);
  while (res.length > max) {
    if (res[1] !== -1) res.splice(1, 1);
    else if (res[res.length - 2] !== -1) res.splice(res.length - 2, 1);
    else res.splice(2, res.length - 4, -1);
  }
  return res;
}
