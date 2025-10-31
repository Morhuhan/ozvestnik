import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import bcrypt from "bcrypt";
import { jwtVerify } from "jose";

const Schema = z.object({
  token: z.string().min(10),
});

function getSecret() {
  const s = process.env.PASSWORD_RESET_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  return new TextEncoder().encode(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = Schema.parse(body);

    const { payload } = await jwtVerify(token, getSecret());
    const email = String(payload.email || "");
    const name = String(payload.name || "");
    const password = String(payload.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Неверный токен" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Пользователь уже существует" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        name: name || undefined,
        role: "READER",
        passwordHash,
      },
    });

    console.log(`✅ Пользователь ${email} успешно зарегистрирован`);
    return NextResponse.json({ ok: true, email, password });
  } catch (e) {
    console.error("Ошибка при завершении регистрации:", e);
    return NextResponse.json({ error: "Неверный или просроченный токен" }, { status: 400 });
  }
}