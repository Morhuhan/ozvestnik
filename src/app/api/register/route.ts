import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { SignJWT } from "jose";
import { sendEmail } from "../../../../lib/email";
import { checkRateLimits, logEmailAttempt } from "../../../../lib/emailRateLimit";
import { getAndHashIp } from "../../../../lib/ip";

const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(200),
});

function getSecret() {
  const s = process.env.PASSWORD_RESET_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  return new TextEncoder().encode(s);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, password } = RegisterSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Пользователь уже существует" }, { status: 409 });
    }

    const ipHash = getAndHashIp(req);
    const rateLimitCheck = await checkRateLimits(email, ipHash, 'register');
    
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: "Вы слишком часто запрашиваете письмо. Пожалуйста, подождите и попробуйте снова." }, { status: 429 });
    }

    await logEmailAttempt(email, ipHash, 'register');

    const token = await new SignJWT({ email, name, password })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(getSecret());

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const confirmUrl = `${baseUrl}/?confirm=${encodeURIComponent(token)}`;

    if (!process.env.API_EMAIL_ENABLED) {
      console.log("\n=== Registration confirmation link ===\n", confirmUrl, "\nДля:", email, "\n");
    } else {
      try {
        await sendEmail({
          to: email,
          subject: "Подтверждение регистрации — Озерский Вестник",
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
      } catch (emailError: any) {
        if (emailError.message === 'GLOBAL_RATE_LIMIT_EXCEEDED') {
          return NextResponse.json({ error: "К сожалению, дневной лимит на отправку писем исчерпан. Попробуйте завтра." }, { status: 429 });
        }
        throw emailError;
      }
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