// src/app/api/admin/logs/route.ts

import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/session";

const ACTIONS = [
  "COMMENT_CREATE",
  "COMMENT_DELETE",
  "USER_REGISTER",
  "USER_BAN",
  "USER_UNBAN",
  "GUEST_BAN",
  "GUEST_UNBAN",
];

export async function GET(req: Request) {
  const s = await getSessionUser();
  if (!s?.id) return NextResponse.json({ message: "Не авторизован" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: s.id }, select: { role: true } });
  if (me?.role !== "ADMIN") return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const qLower = q.toLowerCase();
  const action = (url.searchParams.get("action") || "").trim();
  const actorId = (url.searchParams.get("actorId") || "").trim();
  const articleParam = (url.searchParams.get("article") || "").trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const after = url.searchParams.get("after");
  const takeRaw = Number(url.searchParams.get("take") || 200);
  const take = Math.max(1, Math.min(500, isFinite(takeRaw) ? takeRaw : 200));

  // article (id или slug) -> id
  let filterArticleId: string | null = null;
  if (articleParam) {
    const art = await prisma.article.findFirst({
      where: { OR: [{ id: articleParam }, { slug: articleParam }] },
      select: { id: true },
    });
    filterArticleId = art?.id ?? null;
  }

  const whereAND: any[] = [];
  if (after) whereAND.push({ ts: { gt: new Date(after) } });
  if (from) whereAND.push({ ts: { gte: new Date(from + "T00:00:00") } });
  if (to) whereAND.push({ ts: { lte: new Date(to + "T23:59:59.999") } });
  if (action) whereAND.push({ action });
  if (actorId) whereAND.push({ actorId });

  if (q) {
    const actionMatches = ACTIONS.filter(a => a.toLowerCase().includes(qLower));
    const orQ: any[] = [
      { summary: { contains: q, mode: "insensitive" } },
      {
        actor: {
          is: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
    if (actionMatches.length) {
      orQ.push({ action: { in: actionMatches as any[] } });
    }
    whereAND.push({ OR: orQ });
  }

  if (filterArticleId) {
    whereAND.push({ AND: [{ targetType: "ARTICLE" }, { targetId: filterArticleId }] });
  }

  const where = whereAND.length ? { AND: whereAND } : {};

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { ts: "desc" },
    take,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  // enrich article
  const articleIds = new Set<string>();
  for (const r of rows) {
    if (r.targetType === "ARTICLE" && r.targetId) articleIds.add(r.targetId);
    const d = (r.detail ?? {}) as any;
    if (typeof d?.articleId === "string") articleIds.add(d.articleId);
    const first = Array.isArray(d?.comments) && d.comments.length ? d.comments[0] : null;
    if (first && typeof first.articleId === "string") articleIds.add(first.articleId);
  }

  const articles = articleIds.size
    ? await prisma.article.findMany({
        where: { id: { in: Array.from(articleIds) } },
        select: { id: true, title: true, slug: true },
      })
    : [];
  const articleById = new Map(articles.map((a) => [a.id, a]));

  return NextResponse.json({
    items: rows.map((r) => {
      const d = (r.detail ?? {}) as any;
      let aId: string | null = null;
      if (r.targetType === "ARTICLE" && r.targetId) aId = r.targetId;
      else if (typeof d?.articleId === "string") aId = d.articleId;
      else if (Array.isArray(d?.comments) && d.comments.length && typeof d.comments[0]?.articleId === "string") {
        aId = d.comments[0].articleId;
      }
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
    }),
  });
}
