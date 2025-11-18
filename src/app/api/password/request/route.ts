import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { SignJWT } from "jose";
import { sendEmail } from "../../../../../lib/email";
import { checkRateLimits, logEmailAttempt } from "../../../../../lib/emailRateLimit";
import { getAndHashIp } from "../../../../../lib/ip";

const Schema = z.object({
  email: z.string().email(),
});

function getSecret() {
  const s = process.env.PASSWORD_RESET_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  return new TextEncoder().encode(s);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = Schema.parse(body);

    const ipHash = getAndHashIp(req);
    const rateLimitCheck = await checkRateLimits(email, ipHash, 'password_reset');

    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.reason === 'user_limit') {
        return NextResponse.json({ error: "Вы слишком часто запрашиваете письмо. Пожалуйста, подождите и попробуйте снова." }, { status: 429 });
      }
      if (rateLimitCheck.reason === 'global_limit') {
        return NextResponse.json({ error: "К сожалению, дневной лимит на отправку писем исчерпан. Попробуйте завтра." }, { status: 429 });
      }
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true },
    });

    if (user) {
      await logEmailAttempt(email, ipHash, 'password_reset');

      const token = await new SignJWT({ email })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30m")
        .sign(getSecret());

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset?token=${encodeURIComponent(token)}`;

      if (!process.env.API_EMAIL_ENABLED) {
        console.log("\n=== Password reset link ===\n", resetUrl, "\nДля:", email, "\n");
      } else {
        await sendEmail({
          to: email,
          subject: "Восстановление пароля — Озерский Вестник",
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
        console.log(`📨 Письмо восстановления пароля отправлено на ${email}`);
      }
    } else {
      await logEmailAttempt(null, ipHash, 'password_reset');
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ Ошибка при обработке восстановления пароля:", err);
    return NextResponse.json({ error: "Не удалось отправить письмо" }, { status: 500 });
  }
}