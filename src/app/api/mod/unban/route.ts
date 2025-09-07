// src/app/api/mod/unban/route.ts
import { NextResponse } from "next/server";
import { auditLog } from "../../../../../lib/audit";
import { prisma } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/session";

type UnbanPayload = { userId?: string; commentId?: string; email?: string; ipHash?: string };

export async function POST(req: Request) {
  try {
    const adminSession = await getSessionUser();
    if (!adminSession?.id) return NextResponse.json({ message: "Не авторизован" }, { status: 401 });

    const me = await prisma.user.findUnique({ where: { id: adminSession.id }, select: { id: true, role: true } });
    if (me?.role !== "ADMIN") return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 });

    const payload = (await req.json().catch(() => ({}))) as UnbanPayload;
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    const commentId = typeof payload.commentId === "string" ? payload.commentId : null;
    const email = typeof payload.email === "string" ? payload.email.trim() : null;
    const ipHash = typeof payload.ipHash === "string" ? payload.ipHash.trim() : null;

    if (!userId && !commentId && !email && !ipHash)
      return NextResponse.json({ message: "Нужно указать userId или commentId, либо email/ipHash" }, { status: 400 });

    if (userId) {
      const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
      if (!exists) return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 });

      await prisma.user.update({
        where: { id: userId },
        data: { isBanned: false, bannedAt: null, bannedUntil: null, banReason: null, bannedById: null },
      });

      await auditLog({
        action: "USER_UNBAN",
        targetType: "USER",
        targetId: userId,
        summary: `Разбан пользователя ${exists.name ?? exists.email ?? userId}`,
        detail: { userId },
        actorId: me.id,
      });

      return NextResponse.json({ ok: true, scope: "user", userId });
    }

    if (email || ipHash) {
      await prisma.guestBan.deleteMany({ where: email ? { email } : { ipHash: ipHash! } });

      await auditLog({
        action: "USER_UNBAN",
        targetType: "SYSTEM",
        targetId: null,
        summary: `Разбан гостя (${email ? "email=" + email : "ipHash=" + ipHash})`,
        detail: { email, ipHash },
        actorId: me.id,
      });

      return NextResponse.json({ ok: true, scope: "guest", email: email ?? null, ipHash: ipHash ?? null });
    }

    const c = await prisma.comment.findUnique({
      where: { id: commentId! },
      select: { id: true, isGuest: true, ipHash: true, guestEmail: true, authorId: true },
    });
    if (!c) return NextResponse.json({ message: "Комментарий не найден" }, { status: 404 });

    if (c.isGuest) {
      await prisma.guestBan.deleteMany({
        where: {
          OR: [c.guestEmail ? { email: c.guestEmail } : undefined, c.ipHash ? { ipHash: c.ipHash } : undefined].filter(Boolean) as any,
        },
      });

      await auditLog({
        action: "USER_UNBAN",
        targetType: "COMMENT",
        targetId: c.id,
        summary: `Разбан гостя по commentId=${c.id}`,
        detail: { commentId },
        actorId: me.id,
      });

      return NextResponse.json({ ok: true, scope: "guest", commentId });
    }

    if (!c.authorId) return NextResponse.json({ message: "Не удалось определить автора комментария" }, { status: 400 });

    await prisma.user.update({
      where: { id: c.authorId },
      data: { isBanned: false, bannedAt: null, bannedUntil: null, banReason: null, bannedById: null },
    });

    await auditLog({
      action: "USER_UNBAN",
      targetType: "USER",
      targetId: c.authorId,
      summary: `Разбан пользователя по commentId=${c.id}`,
      detail: { commentId, userId: c.authorId },
      actorId: me.id,
    });

    return NextResponse.json({ ok: true, scope: "user", userId: c.authorId, commentId });
  } catch {
    return NextResponse.json({ message: "Внутренняя ошибка" }, { status: 500 });
  }
}
