import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/db";
import { requireRole } from "../../../../../../../lib/session";

export async function PATCH(req: NextRequest, ctx: any) {
  await requireRole(["EDITOR", "ADMIN"]);

  const { id } = (ctx as { params: { id: string } }).params;

  const body = await req.json().catch(() => ({} as any));
  const inCarousel: boolean | undefined = body?.inCarousel;
  const carouselFromRaw: string | null | undefined = body?.carouselFrom;
  const carouselToRaw: string | null | undefined = body?.carouselTo;

  const article = await prisma.article.findUnique({
    where: { id },
    select: { id: true, status: true, publishedAt: true },
  });

  if (!article) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (inCarousel === true) {
    if (article.status !== "PUBLISHED" || !article.publishedAt) {
      return NextResponse.json({ ok: false, error: "not_published" }, { status: 400 });
    }
  }

  const parseDate = (v: unknown): Date | null => {
    if (v === null || v === undefined || v === "") return null;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
  };

  const data: Record<string, any> = {};
  if (typeof inCarousel === "boolean") data.inCarousel = inCarousel;

  if ("carouselFrom" in (body ?? {})) data.carouselFrom = parseDate(carouselFromRaw);
  if ("carouselTo" in (body ?? {})) data.carouselTo = parseDate(carouselToRaw);

  await prisma.article.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ok: true });
}
