// src/app/api/admin/users/[id]/role/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/db";
import { getSessionUser } from "../../../../../../../lib/session";

const ALLOWED_ROLES = ["ADMIN", "EDITOR", "AUTHOR", "READER"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> } 
) {
  try {
    const { id } = await ctx.params;

    const s = await getSessionUser();
    if (!s?.id) {
      return NextResponse.json({ message: "Не авторизован" }, { status: 401 });
    }

    const me = await prisma.user.findUnique({
      where: { id: s.id },
      select: { id: true, role: true },
    });
    if (me?.role !== "ADMIN") {
      return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 });
    }

    if (id === me.id) {
      return NextResponse.json(
        { message: "Нельзя менять свою роль через админку" },
        { status: 403 }
      );
    }

    const payload = await req.json().catch(() => ({} as any));
    const roleRaw = String(payload?.role || "").toUpperCase();
    if (!ALLOWED_ROLES.includes(roleRaw as Role)) {
      return NextResponse.json(
        { message: "Некорректная роль. Допустимые: ADMIN, EDITOR, AUTHOR, READER" },
        { status: 400 }
      );
    }

    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ message: "Пользователь не найден" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: { role: roleRaw as Role },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ message: "Внутренняя ошибка" }, { status: 500 });
  }
}
