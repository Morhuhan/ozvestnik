import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limitParsed = Number(searchParams.get("limit") || "12");
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(60, limitParsed) : 12;

  const excludeRaw = (searchParams.get("exclude") || "").trim();
  const excludeIds = excludeRaw
    ? excludeRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const where = {
    status: "PUBLISHED" as const,
    publishedAt: { not: null as any },
    ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
  };

  const total = await prisma.article.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * limit;

  const rows = await prisma.article.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    skip,
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      publishedAt: true,
      coverMedia: { select: { id: true } },
      section: { select: { slug: true, name: true } },
      tags: { include: { tag: true } },
      viewsCount: true, // ⬅️ добавили
    },
  });

  // Комментарии (всего, для этих статей)
  const ids = rows.map((r) => r.id);
  const commentsGrouped = ids.length
    ? await prisma.comment.groupBy({
        by: ["articleId"],
        where: { articleId: { in: ids }, status: "PUBLISHED" },
        _count: { articleId: true },
      })
    : [];
  const commentsById = new Map<string, number>(
    commentsGrouped.map((g) => [g.articleId, g._count.articleId])
  );

  const items = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    publishedAt: r.publishedAt,
    coverId: r.coverMedia?.id ?? null,
    section: { slug: r.section?.slug ?? null, name: r.section?.name ?? null },
    tags: r.tags.map((x) => ({ id: x.tag.id, slug: x.tag.slug, name: x.tag.name })),
    commentsCount: commentsById.get(r.id) ?? 0,
    viewsCount: r.viewsCount ?? 0, // ⬅️ прокидываем в ответ
  }));

  const hasMore = currentPage < totalPages;
  return NextResponse.json({ items, hasMore, nextPage: currentPage + 1 });
}
