import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/session";
import { auditLog } from "../../../../../lib/audit";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const s = await getSessionUser();
    if (!s?.id) return NextResponse.json({ message: "Не авторизован" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { id: s.id }, select: { id: true, role: true } });
    if (me?.role !== "ADMIN") return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 });

    // Берём корневой комментарий с articleId
    const root = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        articleId: true,
        parentId: true,
      },
    });
    if (!root) return NextResponse.json({ message: "Не найдено" }, { status: 404 });

    // Собираем всю ветку (BFS)
    const queue: string[] = [root.id];
    const allIds = new Set<string>([root.id]);

    while (queue.length) {
      const chunk = queue.splice(0, 1000);
      const children = await prisma.comment.findMany({
        where: { parentId: { in: chunk } },
        select: { id: true },
      });
      for (const c of children) {
        if (!allIds.has(c.id)) {
          allIds.add(c.id);
          queue.push(c.id);
        }
      }
    }

    const ids = Array.from(allIds);

    // Снэпшот для лога (только необходимые поля + articleId для ссылок)
    const snapshot = await prisma.comment.findMany({
      where: { id: { in: ids } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        articleId: true,
        body: true,
        createdAt: true,
        parentId: true,
        isGuest: true,
        guestName: true,
        guestEmail: true,
        authorId: true,
        author: { select: { name: true, email: true } },
      },
    });

    // Удаляем ветку
    await prisma.comment.deleteMany({ where: { id: { in: ids } } });

    // Лог — целимся в ARTICLE: <articleId>, чтобы API легко подтянул title/slug
    await auditLog({
      action: "COMMENT_DELETE",
      targetType: "ARTICLE",
      targetId: root.articleId,
      summary: `Удалена ветка комментариев (root=${root.id}, count=${ids.length})`,
      detail: {
        articleId: root.articleId,
        commentId: root.id,
        deletedCount: ids.length,
        comments: snapshot.map((c) => ({
          id: c.id,
          articleId: c.articleId,
          body: c.body,
          createdAt: c.createdAt,
          parentId: c.parentId,
          isGuest: c.isGuest,
          guestName: c.guestName,
          guestEmail: c.guestEmail,
          authorId: c.authorId,
          authorName: c.author?.name ?? null,
          authorEmail: c.author?.email ?? null,
        })),
      },
      actorId: me.id,
    });

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (e) {
    return NextResponse.json({ message: "Внутренняя ошибка" }, { status: 500 });
  }
}
