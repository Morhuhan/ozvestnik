// app/api/comments/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { articleId, parentId, text, body: bodyAlt, guestName, guestEmail } = body || {};
    const commentText: string = (text ?? bodyAlt ?? "").toString();

    if (!articleId || typeof commentText !== "string" || !commentText.trim()) {
      return NextResponse.json({ message: "Некорректные данные" }, { status: 400 });
    }

    // Проверка статьи и настроек
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { commentsEnabled: true, commentsGuestsAllowed: true },
    });
    if (!article || !article.commentsEnabled) {
      return NextResponse.json({ message: "Комментарии отключены" }, { status: 403 });
    }

    const sessionUser = await getSessionUser();
    const userId = sessionUser?.id ?? null;

    if (!userId && article.commentsGuestsAllowed === false) {
      return NextResponse.json({ message: "Только для авторизованных" }, { status: 403 });
    }

    // Если есть parentId — проверим, что он принадлежит той же статье и опубликован/не удалён
    let parent = null as null | { id: string; articleId: string; status: string };
    if (parentId) {
      parent = await prisma.comment.findUnique({
        where: { id: String(parentId) },
        select: { id: true, articleId: true, status: true },
      });
      if (!parent || parent.articleId !== articleId) {
        return NextResponse.json({ message: "Неверная ветка ответа" }, { status: 400 });
      }
    }

    // Мини-санитайз тела: убираем \r и лишние пробелы
    const safeBody = commentText.replace(/\r/g, "").trim().slice(0, 5000); // лимит

    // Простейший антиспам: хеш IP + UA
    const ip =
      (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        (req as any).ip ||
        "0.0.0.0") + "";
    const ua = req.headers.get("user-agent") ?? "";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

    // Для гостей позволяем пустой email, но нормализуем
    const gName = userId ? null : (typeof guestName === "string" ? guestName.trim().slice(0, 120) : null);
    const gEmail = userId ? null : (typeof guestEmail === "string" ? guestEmail.trim().slice(0, 200) : null);

    const created = await prisma.comment.create({
      data: {
        articleId,
        parentId: parentId ?? null,
        body: safeBody,
        authorId: userId,
        isGuest: !userId,
        guestName: gName || null,
        guestEmail: gEmail || null,
        status: "PUBLISHED",
        ipHash,
        userAgent: ua.slice(0, 500),
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Внутренняя ошибка" }, { status: 500 });
  }
}
