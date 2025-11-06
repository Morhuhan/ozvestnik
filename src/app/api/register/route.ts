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

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const confirmUrl = `${baseUrl}/?confirm=${encodeURIComponent(token)}`;

    if (!process.env.EMAIL_SERVER) {
      console.log("\n=== Registration confirmation link ===\n", confirmUrl, "\nДля:", email, "\n");
      return NextResponse.json({ ok: true });
    }

    const emailFrom = process.env.EMAIL_FROM || "";
    const emailMatch = emailFrom.match(/<(.+?)>/) || emailFrom.match(/^(.+)$/);
    const fromAddress = emailMatch ? emailMatch[1] : "radionovich.arkadiy@mail.ru";

    const emailServer = process.env.EMAIL_SERVER || "";
    const serverMatch = emailServer.match(/smtps?:\/\/(.+?):(.+?)@(.+?):(\d+)/);

    if (!serverMatch) {
      console.error("❌ Неверный формат EMAIL_SERVER");
      throw new Error("Неверный формат EMAIL_SERVER");
    }

    const [, username, passwordSmtp, host, port] = serverMatch;

    console.log(`📧 Попытка отправки письма подтверждения через ${host}:${port} для ${email}`);

    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: {
        user: username,
        pass: passwordSmtp,
      },
      requireTLS: parseInt(port) === 587,
      tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
      },
    });

    try {
      await transporter.verify();
      console.log("✅ SMTP соединение проверено успешно");

      const info = await transporter.sendMail({
        from: emailFrom || fromAddress,
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
          </div>
        `,
      });

      console.log(`📨 Письмо подтверждения для ${email} успешно отправлено. MessageId: ${info.messageId}`);
      console.log(`📬 Response: ${info.response}`);
    } catch (mailError: any) {
      console.error("❌ Ошибка при отправке письма подтверждения:", mailError);
      console.error("Детали ошибки:", {
        code: mailError.code,
        command: mailError.command,
        response: mailError.response,
        responseCode: mailError.responseCode,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues?.[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    console.error("Ошибка при регистрации", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
