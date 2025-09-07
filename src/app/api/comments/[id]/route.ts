// app/api/comments/[id]/route.ts

import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/session";
import { prisma } from "../../../../../lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ message: "Не указан id" }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json({ message: "Не авторизован" }, { status: 401 });
    }

    const me = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    if (me?.role !== "ADMIN") {
      return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 });
    }

    // Проверим, что комментарий существует
    const exists = await prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ message: "Комментарий не найден" }, { status: 404 });
    }

    await prisma.$executeRaw`
      WITH RECURSIVE subtree AS (
        SELECT id
        FROM "Comment"
        WHERE id = ${id}
        UNION ALL
        SELECT c.id
        FROM "Comment" c
        INNER JOIN subtree s ON c."parentId" = s.id
      )
      UPDATE "Comment"
      SET "status" = 'DELETED'::"CommentStatus",
          "updatedAt" = NOW()
      WHERE id IN (SELECT id FROM subtree)
    `;

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Внутренняя ошибка" }, { status: 500 });
  }
}
