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

  // варианты "показывать по"
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
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Медиа</h1>

        {/* выбор "показывать по" — без JS, просто ссылки */}
        <div className="flex items-center gap-2 text-sm">
          <span className="opacity-70">Показывать по:</span>
          <div className="flex rounded border overflow-hidden">
            {PER_PAGE_OPTIONS.map((n) => (
              <Link
                key={n}
                href={qs(1, n)}
                className={
                  "px-2.5 py-1.5 border-l first:border-l-0 " +
                  (n === perPage ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50")
                }
                aria-current={n === perPage ? "page" : undefined}
              >
                {n}
              </Link>
            ))}
          </div>
          <span className="opacity-70 whitespace-nowrap">Всего: {total}</span>
        </div>
      </div>

      {/* ✅ форма загрузки вынесена в клиентский компонент с проверкой форматов и toast */}
      <UploadForm
        action="/api/admin/media/upload"
        accept={accept}
        allowedMimes={allowedMimes}
        allowedExts={allowedExts}
      />

      <MediaGrid assets={assets as any} />

      {/* пагинация */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm opacity-70">
          Стр. {currentPage} из {totalPages}
        </div>

        <nav className="flex items-center gap-1">
          <Link
            href={qs(Math.max(1, currentPage - 1))}
            aria-disabled={currentPage === 1}
            className={`px-3 py-1.5 rounded border ${
              currentPage === 1 ? "pointer-events-none opacity-40" : ""
            }`}
          >
            ←
          </Link>

          {pageNums.map((n, i) =>
            n === -1 ? (
              <span key={`e${i}`} className="px-2 opacity-60 select-none">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={qs(n)}
                className={`px-3 py-1.5 rounded border ${
                  n === currentPage ? "bg-black text-white border-black" : ""
                }`}
              >
                {n}
              </Link>
            )
          )}

          <Link
            href={qs(Math.min(totalPages, currentPage + 1))}
            aria-disabled={currentPage === totalPages}
            className={`px-3 py-1.5 rounded border ${
              currentPage === totalPages ? "pointer-events-none opacity-40" : ""
            }`}
          >
            →
          </Link>
        </nav>
      </div>
    </div>
  );
}

function getPageNumbers(page: number, total: number): number[] | (-1)[] {
  const max = 7;
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const res: (number | -1)[] = [];
  const pushRange = (a: number, b: number) => {
    for (let i = a; i <= b; i++) res.push(i);
  };
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
  return res as number[];
}
