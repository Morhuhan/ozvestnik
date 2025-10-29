import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { SignJWT } from "jose";
import nodemailer from "nodemailer";

// Проверка входных данных
const Schema = z.object({
  email: z.string().email(),
});

// Получаем секрет для подписи токена
function getSecret() {
  const s = process.env.PASSWORD_RESET_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  return new TextEncoder().encode(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = Schema.parse(body);

    // Проверяем, есть ли пользователь с таким email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true },
    });

    // Даже если пользователя нет — всё равно возвращаем ok (чтобы не раскрывать, кто зарегистрирован)
    if (user) {
      // Генерируем токен, который истечёт через 30 минут
      const token = await new SignJWT({ email })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30m")
        .sign(getSecret());

      // URL для сброса
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset?token=${encodeURIComponent(token)}`;

      // Если не задан EMAIL_SERVER — просто логируем ссылку
      if (!process.env.EMAIL_SERVER) {
        console.log("\n=== Password reset link ===\n", resetUrl, "\nДля:", email, "\n");
      } else {
        // Парсим EMAIL_FROM
        // Формат: "Озерский Вестник <radionovich.arkadiy@mail.ru>"
        const emailFrom = process.env.EMAIL_FROM || "";
        const emailMatch = emailFrom.match(/<(.+?)>/) || emailFrom.match(/^(.+)$/);
        const fromAddress = emailMatch ? emailMatch[1] : "radionovich.arkadiy@mail.ru";

        // Парсим EMAIL_SERVER
        // Формат: smtps://radionovich.arkadiy@mail.ru:xq1OJyYqbOWk9RghWklt@smtp.mail.ru:465
        const emailServer = process.env.EMAIL_SERVER || "";
        const serverMatch = emailServer.match(/smtps?:\/\/(.+?):(.+?)@(.+?):(\d+)/);
        
        if (!serverMatch) {
          console.error("❌ Неверный формат EMAIL_SERVER");
          throw new Error("Неверный формат EMAIL_SERVER");
        }

        const [, username, password, host, port] = serverMatch;

        // Создаём SMTP-транспорт через Mail.ru
        const transporter = nodemailer.createTransport({
          host: host,
          port: parseInt(port),
          secure: port === "465", // true для 465, false для 587
          auth: {
            user: username,
            pass: password,
          },
        });

        // Отправляем письмо
        await transporter.sendMail({
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

        console.log(`📨 Письмо для ${email} успешно отправлено.`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Ошибка при обработке запроса восстановления:", err);
    return NextResponse.json({ error: "Не удалось отправить письмо" }, { status: 500 });
  }
}