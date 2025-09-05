// src/app/api/articles/[id]/view/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { headers } from "next/headers";
import { createHash } from "crypto";

/** IP из заголовков */
function getClientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") || "0.0.0.0";
}

/** sha256(ip|ua|salt) */
function makeSessionHash(ip: string, ua: string): string {
  const salt = process.env.VIEW_HASH_SALT || "somesalt";
  return createHash("sha256").update(`${ip}|${ua}|${salt}`).digest("hex");
}

/** Дата полуночи по UTC для @db.Date */
function todayUtcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: articleId } = await ctx.params;
  if (!articleId) {
    return NextResponse.json({ ok: false, error: "no id" }, { status: 400 });
  }

  // убеждаемся, что статья существует
  const exists = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // сигнатура клиента
  const h = await headers();
  const ua = h.get("user-agent") || "";
  const ip = getClientIp(h);
  const sessionHash = makeSessionHash(ip, ua);
  const viewDate = todayUtcDateOnly();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // пробуем создать уникальную запись за сегодня, без выброса ошибок
      const res = await tx.articleView.createMany({
        data: [{ articleId, sessionHash, viewDate }],
        skipDuplicates: true, // при дубле вернёт count: 0
      });

      const countedUnique = res.count > 0;

      // инкремент viewsCount ТОЛЬКО если просмотр уникальный
      if (countedUnique) {
        await tx.article.update({
          where: { id: articleId },
          data: { viewsCount: { increment: 1 } },
          select: { id: true },
        });
      }

      return { countedUnique };
    });

    return NextResponse.json({ ok: true, counted: result.countedUnique });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}
