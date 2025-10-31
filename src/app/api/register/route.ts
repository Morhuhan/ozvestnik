import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { SignJWT } from "jose";
import nodemailer from "nodemailer";

const RegisterSchema = z.object({
  email: z.string().email(),
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
    const { email, name, password } = RegisterSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Пользователь уже существует" }, { status: 409 });
    }

    const token = await new SignJWT({ email, name, password })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(getSecret());

    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const confirmUrl = `${base}/?confirm=${encodeURIComponent(token)}`;

    if (!process.env.EMAIL_SERVER) {
      console.log("\n=== Registration confirmation link ===\n", confirmUrl, "\nДля:", email, "\n");
    } else {
      const emailServer = process.env.EMAIL_SERVER || "";
      const serverMatch = emailServer.match(/smtps?:\/\/(.+?):(.+?)@(.+?):(\d+)/);
      
      if (!serverMatch) {
        console.error("Неверный формат EMAIL_SERVER");
        throw new Error("Неверный формат EMAIL_SERVER");
      }

      const [, username, pass, host, port] = serverMatch;

      const transporter = nodemailer.createTransport({
        host: host,
        port: parseInt(port),
        secure: port === "465",
        auth: {
          user: username,
          pass: pass,
        },
      });

      const emailFrom = process.env.EMAIL_FROM || "";

      await transporter.sendMail({
        from: emailFrom,
        to: email,
        subject: "Подтверждение регистрации — Озерский Вестник",
        text: `Чтобы завершить регистрацию, перейдите по ссылке: ${confirmUrl}`,
        html: `
          <div style="font-family:Arial,sans-serif;font-size:16px;">
            <p>Здравствуйте, ${name}!</p>
            <p>Чтобы завершить регистрацию на сайте «Озерский Вестник», перейдите по ссылке:</p>
            <p><a href="${confirmUrl}" style="color:#3366cc;">Подтвердить регистрацию</a></p>
            <p>Ссылка действует 24 часа.</p>
            <p>Если вы не регистрировались на нашем сайте — просто игнорируйте это письмо.</p>
            <hr/>
            <p style="font-size:13px;color:#888;">С уважением,<br>Команда «Озерский Вестник»</p>
          </div>`,
      });

      console.log(`📨 Письмо подтверждения для ${email} успешно отправлено`);
    }

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