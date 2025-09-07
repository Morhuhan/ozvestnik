// src/app/api/mod/ban/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/session";

type BanPayload = {
  userId?: string;
  commentId?: string;
  days?: number;
  until?: string;
  reason?: string;
};

export async function POST(req: Request) {
  try {
    const adminSession = await getSessionUser();
    if (!adminSession?.id) return NextResponse.json({ message: "Не авторизован" }, { status: 401 });

    const me = await prisma.user.findUnique({
      where: { id: adminSession.id },
      select: { id: true, role: true },
    });
    if (me?.role !== "ADMIN") return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 });

    const payload = (await req.json().catch(() => ({}))) as BanPayload;
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    const commentId = typeof payload.commentId === "string" ? payload.commentId : null;
    const reason = typeof payload.reason === "string" ? payload.reason.trim().slice(0, 2000) : null;

    if (!userId && !commentId) return NextResponse.json({ message: "Нужно указать userId или commentId" }, { status: 400 });
    if (userId && commentId) return NextResponse.json({ message: "Укажите только одно из: userId или commentId" }, { status: 400 });

    // until/days
    let bannedUntil: Date | null = null;
    if (typeof payload.until === "string") {
      const d = new Date(payload.until);
      bannedUntil = Number.isNaN(+d) ? null : d;
    } else if (Number.isFinite(payload.days!) && (payload.days as number) > 0) {
      bannedUntil = new Date(Date.now() + Math.floor(payload.days as number) * 86400000);
    } else {
      bannedUntil = new Date(Date.now() + 30 * 86400000);
    }

    // A) По userId
    if (userId) {
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (!target) return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 });
      if (["ADMIN", "EDITOR", "AUTHOR"].includes(target.role as any))
        return NextResponse.json({ message: "Эту роль нельзя банить" }, { status: 403 });
      if (target.id === me.id) return NextResponse.json({ message: "Нельзя забанить самого себя" }, { status: 400 });

      await prisma.user.update({
        where: { id: userId },
        data: { isBanned: true, bannedAt: new Date(), bannedUntil, banReason: reason, bannedById: me.id },
      });

      return NextResponse.json({ ok: true, scope: "user", userId, until: bannedUntil?.toISOString() ?? null });
    }

    // Б) По commentId
    const c = await prisma.comment.findUnique({
      where: { id: commentId! },
      select: {
        id: true,
        isGuest: true,
        ipHash: true,
        guestEmail: true,
        authorId: true,
        author: { select: { id: true, role: true } },
      },
    });
    if (!c) return NextResponse.json({ message: "Комментарий не найден" }, { status: 404 });

    if (c.isGuest) {
      const tasks: Promise<any>[] = [];
      if (c.guestEmail) {
        tasks.push(
          prisma.guestBan.upsert({
            where: { email: c.guestEmail },
            update: { until: bannedUntil, reason: reason || "Модерация: нарушение правил", createdById: me.id },
            create: { email: c.guestEmail, ipHash: c.ipHash ?? null, until: bannedUntil, reason: reason || "Модерация: нарушение правил", createdById: me.id },
          })
        );
      }
      if (c.ipHash) {
        tasks.push(
          prisma.guestBan.upsert({
            where: { ipHash: c.ipHash },
            update: { until: bannedUntil, reason: reason || "Модерация: нарушение правил", createdById: me.id },
            create: { ipHash: c.ipHash, until: bannedUntil, reason: reason || "Модерация: нарушение правил", createdById: me.id },
          })
        );
      }
      if (tasks.length === 0) return NextResponse.json({ message: "Недостаточно данных для бана гостя (нет email/ipHash)" }, { status: 400 });
      await Promise.all(tasks);
      return NextResponse.json({ ok: true, scope: "guest", commentId, until: bannedUntil?.toISOString() ?? null });
    }

    if (!c.authorId) return NextResponse.json({ message: "Не удалось определить автора комментария" }, { status: 400 });
    if (c.author && ["ADMIN", "EDITOR", "AUTHOR"].includes(c.author.role as any))
      return NextResponse.json({ message: "Эту роль нельзя банить" }, { status: 403 });

    await prisma.user.update({
      where: { id: c.authorId },
      data: { isBanned: true, bannedAt: new Date(), bannedUntil, banReason: reason, bannedById: me.id },
    });

    return NextResponse.json({
      ok: true,
      scope: "user",
      userId: c.authorId,
      commentId,
      until: bannedUntil?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ message: "Внутренняя ошибка" }, { status: 500 });
  }
}
