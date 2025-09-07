// src/app/admin/logs/page.tsx
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import LogsClient from "./LogsClient";
import { prisma } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";

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

const ACTIONS = [
  "COMMENT_CREATE",
  "COMMENT_DELETE",
  "USER_REGISTER",
  "USER_BAN",
  "USER_UNBAN",
  "GUEST_BAN",
  "GUEST_UNBAN",
] as const;

type SP = {
  action?: string;
  actorId?: string;
  article?: string; // id или slug
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  page?: string;
  limit?: string;
};

export default async function AdminLogsPage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};

  const s = await getSessionUser();
  if (!s?.id) notFound();
  const me = await prisma.user.findUnique({ where: { id: s.id }, select: { role: true } });
  if (me?.role !== "ADMIN") notFound();

  // Фильтры (без текстового поиска)
  const action = (sp.action || "").trim();
  const actorId = (sp.actorId || "").trim();
  const articleParam = (sp.article || "").trim();
  const from = (sp.from || "").trim();
  const to = (sp.to || "").trim();

  // Пагинация
  const PER_PAGE = [50, 100, 200] as const;
  const limitParsed = Number(sp.limit);
  const perPage = PER_PAGE.includes(limitParsed as any) ? (limitParsed as (typeof PER_PAGE)[number]) : 100;
  const pageParsed = Number(sp.page);
  const page = Number.isFinite(pageParsed) && pageParsed > 0 ? Math.floor(pageParsed) : 1;

  // Резолвим articleParam -> articleId (id или slug)
  let filterArticleId: string | null = null;
  if (articleParam) {
    const art = await prisma.article.findFirst({
      where: { OR: [{ id: articleParam }, { slug: articleParam }] },
      select: { id: true },
    });
    filterArticleId = art?.id ?? null;
  }

  // WHERE
  const whereAND: any[] = [];
  if (from) whereAND.push({ ts: { gte: new Date(from + "T00:00:00") } });
  if (to) whereAND.push({ ts: { lte: new Date(to + "T23:59:59.999") } });
  if (action) whereAND.push({ action });
  if (actorId) whereAND.push({ actorId });
  if (filterArticleId) {
    whereAND.push({ AND: [{ targetType: "ARTICLE" }, { targetId: filterArticleId }] });
  }
  const where = whereAND.length ? { AND: whereAND } : {};

  // Счётчик + выборка
  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * perPage;

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { ts: "desc" },
    take: perPage,
    skip,
    include: { actor: { select: { id: true, name: true, email: true } } },
  });

  // Обогащение статьями для ссылок
  const articleIds = new Set<string>();
  for (const r of rows) {
    if (r.targetType === "ARTICLE" && r.targetId) articleIds.add(r.targetId);
    const d = (r.detail ?? {}) as any;
    if (typeof d?.articleId === "string") articleIds.add(d.articleId);
    const first = Array.isArray(d?.comments) && d.comments.length ? d.comments[0] : null;
    if (first && typeof first.articleId === "string") articleIds.add(first.articleId);
  }
  const articles = articleIds.size
    ? await prisma.article.findMany({ where: { id: { in: Array.from(articleIds) } }, select: { id: true, title: true, slug: true } })
    : [];
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const initial = rows.map((r) => {
    const d = (r.detail ?? {}) as any;
    let aId: string | null = null;
    if (r.targetType === "ARTICLE" && r.targetId) aId = r.targetId;
    else if (typeof d?.articleId === "string") aId = d.articleId;
    else if (Array.isArray(d?.comments) && d.comments.length && typeof d.comments[0]?.articleId === "string") aId = d.comments[0].articleId;
    const art = aId ? articleById.get(aId) ?? null : null;

    return {
      id: r.id,
      ts: r.ts.toISOString(),
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      summary: r.summary,
      detail: r.detail,
      actor: r.actor ? { id: r.actor.id, name: r.actor.name, email: r.actor.email } : null,
      article: art ? { id: art.id, title: art.title, slug: art.slug } : null,
    };
  });

  const qs = (p: number, l: number = perPage) => {
    const sp = new URLSearchParams({
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(articleParam ? { article: articleParam } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page: String(p),
      limit: String(l),
    });
    return `?${sp.toString()}`;
  };

  // fetchQuery для live-пуллинга (те же фильтры)
  const fetchQuery = (() => {
    const sp = new URLSearchParams({
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(articleParam ? { article: articleParam } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      take: String(perPage),
    });
    return `?${sp.toString()}`;
  })();

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Журнал событий</h1>
      </div>

      {/* Фильтры (без текстового поиска) */}
      <form className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200 shadow-sm mb-6 grid gap-3 md:grid-cols-6" method="get">
        <div>
          <label className="mb-1 block text-xs text-neutral-600">Действие</label>
          <select name="action" defaultValue={action} className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-700">
            <option value="">Все</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-600">ID инициатора</label>
          <input name="actorId" defaultValue={actorId} placeholder="userId" className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-700" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-600">Статья (id или slug)</label>
          <input name="article" defaultValue={articleParam} placeholder="id или slug" className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-700" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-600">С даты</label>
          <input type="date" name="from" defaultValue={from} className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-700" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-600">По дату</label>
          <input type="date" name="to" defaultValue={to} className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-700" />
        </div>

        <div className="md:col-span-6 flex justify-end gap-2">
          <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800">Применить</button>
          {(action || actorId || articleParam || from || to) && (
            <a href="/admin/logs" className="rounded-lg bg-white px-4 py-2 ring-1 ring-neutral-300 hover:bg-neutral-100">Сбросить</a>
          )}
        </div>
      </form>

      <LogsClient initial={initial} live={currentPage === 1} fetchQuery={fetchQuery} />

      {/* Пагинация */}
      <div className="mt-8 flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <div className="text-[13px] text-neutral-600">
          Стр. {currentPage} из {totalPages} • всего {total}
        </div>

        <div className="flex items-center">
          <div className="mr-4 md:mr-6 flex items-center gap-2 text-sm">
            <span className="text-neutral-600">Показывать по:</span>
            <div className="flex overflow-hidden rounded-full ring-1 ring-neutral-300">
              {[50, 100, 200].map((n) => (
                <a key={n} href={qs(1, n)} className={"px-3 py-1.5 " + (n === perPage ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100")} aria-current={n === perPage ? "page" : undefined}>
                  {n}
                </a>
              ))}
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <a href={qs(Math.max(1, currentPage - 1))} aria-disabled={currentPage === 1} className={`rounded-full px-3 py-1.5 ring-1 ring-neutral-300 ${currentPage === 1 ? "pointer-events-none opacity-40" : "hover:bg-neutral-100"}`}>←</a>

            {getPageNumbers(currentPage, totalPages).map((n, i) =>
              n === -1 ? (
                <span key={`e${i}`} className="select-none px-2 text-neutral-500">…</span>
              ) : (
                <a key={n} href={qs(n)} className={`rounded-full px-3 py-1.5 ring-1 ring-neutral-300 ${n === currentPage ? "bg-neutral-900 text-white ring-neutral-900" : "hover:bg-neutral-100"}`} aria-current={n === currentPage ? "page" : undefined}>
                  {n}
                </a>
              )
            )}

            <a href={qs(Math.min(totalPages, currentPage + 1))} aria-disabled={currentPage === totalPages} className={`rounded-full px-3 py-1.5 ring-1 ring-neutral-300 ${currentPage === totalPages ? "pointer-events-none opacity-40" : "hover:bg-neutral-100"}`}>→</a>
          </nav>
        </div>
      </div>
    </main>
  );
}
