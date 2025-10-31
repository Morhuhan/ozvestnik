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

    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true },
    });

    if (user) {
      const token = await new SignJWT({ email })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30m")
        .sign(getSecret());

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset?token=${encodeURIComponent(token)}`;

      if (!process.env.EMAIL_SERVER) {
        console.log("\n=== Password reset link ===\n", resetUrl, "\nДля:", email, "\n");
      } else {
        const emailFrom = process.env.EMAIL_FROM || "";
        const emailMatch = emailFrom.match(/<(.+?)>/) || emailFrom.match(/^(.+)$/);
        const fromAddress = emailMatch ? emailMatch[1] : "radionovich.arkadiy@mail.ru";

        const emailServer = process.env.EMAIL_SERVER || "";
        const serverMatch = emailServer.match(/smtps?:\/\/(.+?):(.+?)@(.+?):(\d+)/);
        
        if (!serverMatch) {
          console.error("❌ Неверный формат EMAIL_SERVER");
          throw new Error("Неверный формат EMAIL_SERVER");
        }

        const [, username, password, host, port] = serverMatch;

        console.log(`📧 Попытка отправки письма через ${host}:${port} для ${email}`);

        const transporter = nodemailer.createTransport({
          host: host,
          port: parseInt(port),
          secure: port === "465",
          auth: {
            user: username,
            pass: password,
          },
          connectionTimeout: 10000,
          greetingTimeout: 5000,
          socketTimeout: 10000,
          logger: process.env.NEXTAUTH_DEBUG === "true",
          debug: process.env.NEXTAUTH_DEBUG === "true",
          requireTLS: port !== "465",
          tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false
          }
        });

        try {
          await transporter.verify();
          console.log("✅ SMTP соединение проверено успешно");

          const info = await transporter.sendMail({
            from: emailFrom,
            to: email,
            subject: "Восстановление пароля — Озерский Вестник",
            text: `Чтобы сбросить пароль, перейдите по ссылке: ${resetUrl}`,
            html: `
              <div style="font-family:Arial,sans-serif;font-size:16px;">
                <p>Здравствуйте!</p>
                <p>Чтобы сбросить пароль, нажмите на ссылку ниже:</p>
                <p><a href="${resetUrl}" style="color:#3366cc;">Сбросить пароль</a></p>
                <p>Ссылка активна 30 минут.</p>
                <p>Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.</p>
                <hr/>
                <p style="font-size:13px;color:#888;">С уважением,<br>Команда «Озерский Вестник»</p>
              </div>
            `,
          });

          console.log(`📨 Письмо для ${email} успешно отправлено. MessageId: ${info.messageId}`);
          console.log(`📬 Response: ${info.response}`);
        } catch (mailError: any) {
          console.error("❌ Ошибка при отправке письма:", mailError);
          console.error("Детали ошибки:", {
            code: mailError.code,
            command: mailError.command,
            response: mailError.response,
            responseCode: mailError.responseCode,
          });
          
          return NextResponse.json({ ok: true });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ Общая ошибка при обработке запроса восстановления:", err);
    return NextResponse.json({ error: "Не удалось отправить письмо" }, { status: 500 });
  }
}