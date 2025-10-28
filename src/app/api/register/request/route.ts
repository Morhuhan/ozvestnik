import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { SignJWT } from "jose";
import nodemailer from "nodemailer";

const Schema = z.object({
  email: z.string().email(),
});

function getSecret() {
  const s = process.env.PASSWORD_RESET_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  return new TextEncoder().encode(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = Schema.parse(body);

    const user = await prisma.user.findUnique({ where: { email }, select: { email: true } });

    // Даже если пользователя нет — не раскрываем это (безопасность)
    if (user) {
      const token = await new SignJWT({ email })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30m")
        .sign(getSecret());

      const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${base}/reset?token=${encodeURIComponent(token)}`;

      if (!process.env.EMAIL_SERVER) {
        console.log("\n=== Password reset link ===\n", resetUrl, "\nДля:", email, "\n");
      } else {
        const transporter = nodemailer.createTransport({
          host: "smtp.mail.ru",
          port: 465,
          secure: true,
          auth: {
            user: process.env.EMAIL_FROM?.match(/<(.*?)>/)?.[1] ?? "", // вытащим email из EMAIL_FROM
            pass: process.env.EMAIL_SERVER?.match(/:(.*?)@smtp\.mail\.ru/)?.[1] ?? "",
          },
        });

        await transporter.sendMail({
          to: email,
          from: process.env.EMAIL_FROM,
          subject: "Восстановление пароля — Озерский Вестник",
          text: `Чтобы сбросить пароль, перейдите по ссылке: ${resetUrl}`,
          html: `
            <div style="font-family:Arial,sans-serif;font-size:16px;">
              <p>Здравствуйте!</p>
              <p>Чтобы сбросить пароль, перейдите по ссылке:</p>
              <p><a href="${resetUrl}" style="color:#3366cc;">${resetUrl}</a></p>
              <p>Ссылка действует 30 минут.</p>
              <p>Если вы не запрашивали сброс пароля — просто игнорируйте это письмо.</p>
              <hr/>
              <p style="font-size:13px;color:#888;">С уважением,<br>Команда «Озерский Вестник»</p>
            </div>`,
        });

        console.log(`📨 Письмо для ${email} успешно отправлено`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Ошибка при отправке письма:", e);
    return NextResponse.json({ error: "Не удалось отправить письмо" }, { status: 500 });
  }
}
