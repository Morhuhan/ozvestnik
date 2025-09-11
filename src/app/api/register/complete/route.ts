import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../../../../../lib/db";

const Schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = Schema.parse(body);

    const t = await prisma.emailToken.findUnique({ where: { token } });
    if (!t || t.usedAt || t.expiresAt < new Date()) {
      return NextResponse.json({ error: "Токен недействителен" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);

    // создаём пользователя, если его ещё нет
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {
        passwordHash: hash,
        emailVerified: new Date(),
        name: t.name ?? undefined, // <-- не null
      },
      create: {
        email: t.email,
        name: t.name ?? undefined, // <-- не null
        role: t.role,
        emailVerified: new Date(),
        passwordHash: hash,
      },
      select: { id: true, email: true },
    });

    await prisma.emailToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ ok: true, email: user.email });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка" }, { status: 400 });
  }
}
