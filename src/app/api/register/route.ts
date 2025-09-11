import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../../../../lib/db";

const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, password } = RegisterSchema.parse(body);

    // не даём регистрировать уже существующий email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Пользователь уже существует" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        name: name ?? undefined, // <-- важно: undefined, не null
        role: "READER",
        passwordHash,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues?.[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    console.error("register error", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
