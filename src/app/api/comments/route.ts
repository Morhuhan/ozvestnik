// app/api/comments/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";

type TokenPayload = { issuedAt?: number; sig?: string | null };

// ──────────────────────────────────────────────────────────────────────────────
// Helpers

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0@]+/g, "o")
    .replace(/[@a4]/g, "a")
    .replace(/[i1¡]/g, "i")
    .replace(/[e3]/g, "e")
    .replace(/[s\$]/g, "s")
    .replace(/[^a-zа-яё0-9\s]/gi, " ");
}
function moderate(body: string) {
  const text = normalize(body);
  const profanity = [/\b(?:хуй|пизд|еб[ауое]|бля|сука|мудак|идиот)\w*\b/iu, /\b(?:fuck|shit|bitch|asshole|dick|cunt)\w*\b/iu];
  const spamWords = [/\b(?:viagra|casino|crypto|бинарн(?:ые|ых)\s+опци|ставк[аи]|телеграм\s*канал)\b/iu];
  const links = (text.match(/https?:\/\/|www\./g) || []).length;
  if (spamWords.some((r) => r.test(text))) return { action: "queue" as const, reason: "spam_keywords" };
  if (profanity.some((r) => r.test(text))) return { action: "queue" as const, reason: "profanity" };
  if (links > 2) return { action: "queue" as const, reason: "too_many_links" };
  if (/(.)\1\1\1/.test(text)) return { action: "queue" as const, reason: "flood" };
  return { action: "allow" as const, reason: null };
}
function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function pluralSec(n: number) {
  const t = Math.abs(n) % 100;
  const u = t % 10;
  if (t > 10 && t < 20) return "секунд";
  if (u === 1) return "секунду";
  if (u >= 2 && u <= 4) return "секунды";
  return "секунд";
}

// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const {
      articleId,
      parentId,
      text,
      body: bodyAlt,
      guestName,
      guestEmail,
      hp,
      token,
    }: {
      articleId?: string;
      parentId?: string | null;
      text?: string;
      body?: string;
      guestName?: string;
      guestEmail?: string;
      hp?: string;
      token?: TokenPayload;
    } = raw || {};

    const headers = req.headers;
    const ua = headers.get("user-agent") ?? "";
    const ip = (headers.get("x-forwarded-for")?.split(",")[0]?.trim() || (req as any).ip || "0.0.0.0") + "";
    const ipHash = sha256(ip);

    const sessionUser = await getSessionUser();
    const userId = sessionUser?.id ?? null;

    // Подтянем роль и бан только если это авторизованный пользователь
    const userRow = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, isBanned: true, bannedUntil: true },
        })
      : null;

    // 🔰 Привилегированные роли без ограничений
    const privileged = !!userRow && ["ADMIN", "EDITOR", "AUTHOR"].includes(userRow.role as any);

    const commentText: string = (text ?? bodyAlt ?? "").toString();

    // Honeypot: для обычных — «тихий игнор», для привилегий — пропускаем
    if (!privileged && typeof hp === "string" && hp.trim().length > 0) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!articleId || typeof commentText !== "string" || !commentText.trim()) {
      return NextResponse.json({ message: "Некорректные данные" }, { status: 400 });
    }

    // Статья: уважаем флаг включенности комментариев для всех (в т.ч. привилегий)
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { commentsEnabled: true, commentsGuestsAllowed: true },
    });
    if (!article || !article.commentsEnabled) {
      return NextResponse.json({ message: "Комментарии отключены" }, { status: 403 });
    }

    // Гости запрещены?
    if (!userId && article.commentsGuestsAllowed === false) {
      return NextResponse.json({ message: "Только для авторизованных" }, { status: 403 });
    }

    // Для не-привилегий — проверка токена формы (антибот)
    if (!privileged) {
      const secret = process.env.COMMENT_TOKEN_SECRET || "";
      if (!token || typeof token.issuedAt !== "number") {
        return NextResponse.json({ message: "Токен формы отсутствует" }, { status: 400 });
      }
      const ageSec = (Date.now() - token.issuedAt) / 1000;
      if (ageSec < 3) {
        return NextResponse.json({ message: "Слишком быстрое отправление" }, { status: 429 });
      }
      if (ageSec > 7200) {
        return NextResponse.json({ message: "Токен формы истёк" }, { status: 400 });
      }
      if (secret) {
        const uaHash = sha256(ua).slice(0, 32);
        const expectSig = crypto.createHmac("sha256", secret).update(`${token.issuedAt}:${uaHash}`).digest("hex");
        if (token.sig !== expectSig) {
          return NextResponse.json({ message: "Недействительный токен" }, { status: 400 });
        }
      }
    }

    // Бан пользователя: привилегированные роли не блокируются
    if (userId && !privileged) {
      const now = new Date();
      if (userRow && (userRow.isBanned || (userRow.bannedUntil && userRow.bannedUntil > now))) {
        return NextResponse.json(
          { message: "Ваш аккаунт заблокирован, комментирование недоступно." },
          { status: 403 }
        );
      }
    }

    // Проверка родителя (для всех — корректность дерева)
    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: String(parentId) },
        select: { id: true, articleId: true, status: true },
      });
      if (!parent || parent.articleId !== articleId) {
        return NextResponse.json({ message: "Неверная ветка ответа" }, { status: 400 });
      }
      if (parent.status !== "PUBLISHED" && !privileged) {
        return NextResponse.json({ message: "Нельзя отвечать на скрытый/удалённый комментарий" }, { status: 400 });
      }
    }

    // Нормализуем гостевые поля и проверим бан гостя (для неавторизованных)
    const gName = userId ? null : (typeof guestName === "string" ? guestName.trim().slice(0, 120) : null);
    const gEmail = userId ? null : (typeof guestEmail === "string" ? guestEmail.trim().slice(0, 200) : null);

    if (!userId) {
      const now = new Date();
      const orConds: any[] = [{ ipHash }];
      if (gEmail) orConds.push({ email: gEmail });
      const guestBan = await prisma.guestBan.findFirst({
        where: { AND: [{ OR: orConds }, { OR: [{ until: null }, { until: { gt: now } }] }] },
        select: { reason: true, until: true },
      });
      if (guestBan) {
        return NextResponse.json(
          {
            message:
              `Вы заблокированы` +
              (guestBan.until ? ` до ${new Date(guestBan.until).toLocaleString("ru-RU")}` : "") +
              (guestBan.reason ? `. Причина: ${guestBan.reason}` : ""),
          },
          { status: 403 }
        );
      }
    }

    // Текст
    const safeBody = commentText.replace(/\r/g, "").trim().slice(0, 2000);

    // Лимиты/дубликаты/автомодерация — только для обычных
    if (!privileged) {
      // 30 сек: сообщаем, сколько ждать
      const lastRecent = await prisma.comment.findFirst({
        where: { ipHash, createdAt: { gt: new Date(Date.now() - 30 * 1000) } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (lastRecent) {
        const elapsedMs = Date.now() - new Date(lastRecent.createdAt).getTime();
        const remainMs = Math.max(0, 30 * 1000 - elapsedMs);
        const waitSec = Math.max(1, Math.ceil(remainMs / 1000));
        return NextResponse.json(
          { message: `Слишком часто. Подождите ещё ${waitSec} ${pluralSec(waitSec)}.` },
          { status: 429 }
        );
      }
      // часовой лимит
      const recentHour = await prisma.comment.count({
        where: { ...(userId ? { authorId: userId } : { ipHash }), createdAt: { gt: new Date(Date.now() - 3600 * 1000) } },
      });
      const limitHour = userId ? 60 : 10;
      if (recentHour >= limitHour) {
        return NextResponse.json({ message: "Превышен лимит сообщений за час." }, { status: 429 });
      }
      // дубликаты (10 мин)
      const dup = await prisma.comment.findFirst({
        where: { ipHash, body: safeBody, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json({ message: "Похоже на дубликат сообщения." }, { status: 409 });
      }
    }

    // Автомодерация
    const mod = privileged ? { action: "allow" as const, reason: null } : moderate(safeBody);
    const targetStatus = mod.action === "queue" ? "PENDING" : "PUBLISHED";

    const created = await prisma.comment.create({
      data: {
        articleId,
        parentId: parentId ?? null,
        body: safeBody,
        authorId: userId,
        isGuest: !userId,
        guestName: gName || null,
        guestEmail: gEmail || null,
        status: targetStatus as any,
        ipHash,
        userAgent: ua.slice(0, 500),
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: created.id, queued: targetStatus === "PENDING" });
  } catch {
    return NextResponse.json({ message: "Внутренняя ошибка" }, { status: 500 });
  }
}
