import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import bcrypt from "bcrypt";
import { jwtVerify } from "jose";

const Schema = z.object({
  token: z.string().min(10),
});

const PayloadSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(200),
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
    
    const validated = PayloadSchema.parse({
      email: payload.email,
      name: payload.name,
      password: payload.password,
    });

    const existing = await prisma.user.findUnique({ where: { email: validated.email } });
    if (existing) {
      return NextResponse.json({ error: "Пользователь уже существует" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(validated.password, 12);

    await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        role: "READER",
        passwordHash,
      },
    });

    console.log(`Пользователь ${validated.email} успешно зарегистрирован`);
    return NextResponse.json({ ok: true, email: validated.email, password: validated.password });
  } catch (e) {
    console.error("Ошибка при завершении регистрации:", e);
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Некорректные данные в токене" }, { status: 400 });
    }
    return NextResponse.json({ error: "Неверный или просроченный токен" }, { status: 400 });
  }
}