// src/app/api/mod/unban/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/session";

type UnbanPayload = {
  userId?: string;
  commentId?: string;
  email?: string;
  ipHash?: string;
};

export async function POST(req: Request) {
  try {
    const adminSession = await getSessionUser();
    if (!adminSession?.id) {
      return NextResponse.json({ message: "Не авторизован" }, { status: 401 });
    }

    const me = await prisma.user.findUnique({
      where: { id: adminSession.id },
      select: { id: true, role: true },
    });
    if (me?.role !== "ADMIN") {
      return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 });
    }

    const payload = (await req.json().catch(() => ({}))) as UnbanPayload;
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    const commentId = typeof payload.commentId === "string" ? payload.commentId : null;
    const email = typeof payload.email === "string" ? payload.email.trim() : null;
    const ipHash = typeof payload.ipHash === "string" ? payload.ipHash.trim() : null;

    if (!userId && !commentId && !email && !ipHash) {
      return NextResponse.json(
        { message: "Нужно указать userId или commentId, либо email/ipHash" },
        { status: 400 }
      );
    }

    // A) Разбан по userId
    if (userId) {
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: false,
          bannedAt: null,
          bannedUntil: null,
          banReason: null,
          bannedById: null,
        },
      });

      return NextResponse.json({ ok: true, scope: "user", userId });
    }

    // B) Разбан гостя напрямую по email/ipHash (если заданы)
    if (email || ipHash) {
      const where = email
        ? { email }
        : { ipHash: ipHash! };
      await prisma.guestBan.deleteMany({ where });
      return NextResponse.json({ ok: true, scope: "guest", email: email ?? null, ipHash: ipHash ?? null });
    }

    // C) Разбан по commentId
    const c = await prisma.comment.findUnique({
      where: { id: commentId! },
      select: {
        id: true,
        isGuest: true,
        ipHash: true,
        guestEmail: true,
        authorId: true,
      },
    });
    if (!c) {
      return NextResponse.json({ message: "Комментарий не найден" }, { status: 404 });
    }

    if (c.isGuest) {
      // гость: убираем все бан-записи по email/ipHash
      await prisma.guestBan.deleteMany({
        where: {
          OR: [
            c.guestEmail ? { email: c.guestEmail } : undefined,
            c.ipHash ? { ipHash: c.ipHash } : undefined,
          ].filter(Boolean) as any,
        },
      });
      return NextResponse.json({ ok: true, scope: "guest", commentId });
    }

    // зарегистрированный пользователь через commentId
    if (!c.authorId) {
      return NextResponse.json({ message: "Не удалось определить автора комментария" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: c.authorId },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
        bannedById: null,
      },
    });
    return NextResponse.json({ ok: true, scope: "user", userId: c.authorId, commentId });
  } catch {
    return NextResponse.json({ message: "Внутренняя ошибка" }, { status: 500 });
  }
}
