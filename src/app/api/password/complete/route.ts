import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import bcrypt from "bcrypt";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const Schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

function getSecret() {
  const s = process.env.PASSWORD_RESET_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  return new TextEncoder().encode(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = Schema.parse(body);

    const { payload } = await jwtVerify(token, getSecret());
    const email = String(payload.email || "");

    if (!email) {
      return NextResponse.json({ error: "Неверный токен" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    const sessionToken = await new SignJWT({ 
      userId: user.id, 
      email: user.email 
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(getSecret());

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: "auth-token",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (e) {
    console.error("Ошибка при завершении сброса пароля:", e);
    return NextResponse.json({ error: "Неверный или просроченный токен" }, { status: 400 });
  }
}