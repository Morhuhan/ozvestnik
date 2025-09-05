import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/db";
import { requireRole } from "../../../../../../../lib/session";

export const PATCH = async (req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole(["EDITOR", "ADMIN"]);
  const { id } = params;

  const body = await req.json().catch(() => ({}));
  const { inCarousel, order }: { inCarousel?: boolean; order?: number | null } = body || {};

  const a = await prisma.article.findUnique({
    where: { id },
    select: { id: true, status: true, publishedAt: true },
  });
  if (!a) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (inCarousel === true) {
    // разрешаем только опубликованные
    if (a.status !== "PUBLISHED" || !a.publishedAt) {
      return NextResponse.json({ ok: false, error: "not_published" }, { status: 400 });
    }
  }

  await prisma.article.update({
    where: { id },
    data: {
      inCarousel: inCarousel ?? undefined,
      carouselOrder: typeof order === "number" ? order : undefined,
    },
  });

  return NextResponse.json({ ok: true });
};
