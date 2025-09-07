// app/api/comments/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";
import { auditLog } from "../../../../lib/audit";

type TokenPayload = { issuedAt?: number; sig?: string | null };

// ──────────────────────────────────────────────────────────────────────────────
// Helpers

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Нормализация для «грубого» поиска спам-фраз (leetspeak и т.п.)
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // удалить комб. диакритики
    .replace(/[0@]+/g, "o")
    .replace(/[@a4]/g, "a")
    .replace(/[i1¡]/g, "i")
    .replace(/[e3]/g, "e")
    .replace(/[s\$]/g, "s")
    .replace(/[^a-zа-яё0-9\s]/gi, " ");
}

function pluralSec(n: number) {
  const t = Math.abs(n) % 100;
  const u = t % 10;
  if (t > 10 && t < 20) return "секунд";
  if (u === 1) return "секунду";
  if (u >= 2 && u <= 4) return "секунды";
  return "секунд";
}

// «Граница слова» без \b (Unicode):
// (^|не-буква/цифра/_) (слово) (?=$|не-буква/цифра/_)
function makeWordRx(source: string) {
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}_])(${source})(?=$|[^\\p{L}\\p{N}_])`,
    "iu"
  );
}

// Поиск нарушений. Возвращает {rule, snippet, extra?} либо null.
function findViolation(
  originalBody: string
): null | { rule: "profanity" | "spam" | "too_many_links"; snippet: string; extra?: any } {
  // 1) Ссылки в оригинальном тексте
  const linkRe = /https?:\/\/\S+|www\.\S+/gi;
  const links = originalBody.match(linkRe) || [];
  if (links.length > 2) {
    const firstLink = links[0]!; // при length>2 гарантированно есть
    return { rule: "too_many_links", snippet: firstLink, extra: { count: links.length } };
  }

  // 2) Ненормативная лексика — на оригинальном тексте с Unicode-границами
  // Расширили «хуй» → ху[йи] + любые суффиксы (ловит «хуйня», «хуйлан», «хуйян» и т.д.)
  const RU =
    "(?:" +
    "ху[йи][\\p{L}\\p{N}_]*|" +                  // хуй… / хуйня / хуйлан / …
    "пизд[\\p{L}\\p{N}_]*|" +                    // пизд…
    "[её]б[аоёиуе][\\p{L}\\p{N}_]*|" +           // еба…/ёба…/ебо…/…
    "бл[яеё][\\p{L}\\p{N}_]*|" +                 // бля…/бле…/блё…
    "сука[\\p{L}\\p{N}_]*|" +
    "мудак[\\p{L}\\p{N}_]*|" +
    "идиот[\\p{L}\\p{N}_]*|" +
    "пид[оа]р[\\p{L}\\p{N}_]*|" +                // пидор/пидар…
    "гандон[\\p{L}\\p{N}_]*|гондон[\\p{L}\\p{N}_]*|" +
    "шлюх[\\p{L}\\p{N}_]*|" +
    "говн[\\p{L}\\p{N}_]*|" +
    "дерьм[\\p{L}\\p{N}_]*" +
    ")";
  const EN =
    "(?:" +
    "fuck[\\p{L}\\p{N}_]*|" +
    "shit[\\p{L}\\p{N}_]*|" +
    "bitch[\\p{L}\\p{N}_]*|" +
    "asshole[\\p{L}\\p{N}_]*|" +
    "dick[\\p{L}\\p{N}_]*|" +
    "cunt[\\p{L}\\p{N}_]*" +
    ")";

  let m = makeWordRx(RU).exec(originalBody);
  if (m) return { rule: "profanity", snippet: m[1]! };
  m = makeWordRx(EN).exec(originalBody);
  if (m) return { rule: "profanity", snippet: m[1]! };

  // 3) Спам-фразы — по нормализованному тексту (устойчиво к вариациям)
  const textNorm = normalize(originalBody);
  const spamPatterns: RegExp[] = [
    /(viagra)/iu,
    /(casino)/iu,
    /(crypto)/iu,
    /(бинарн(?:ые|ых)\s+опц\w*)/iu, // бинарные опции
    /(ставк[аи])/iu,
    /(телеграм\s*канал)/iu,
  ];
  for (const rx of spamPatterns) {
    const sm = rx.exec(textNorm);
    if (sm) return { rule: "spam", snippet: sm[1]! };
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({} as any));
    const {
      articleId,
      parentId,
      text,
      body: bodyAlt,
      guestName,
      guestEmail,
      hp,     // honeypot
      token,  // anti-bot token
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

    // Заголовки
    const ua = req.headers.get("user-agent") ?? "";
    const ipHeader = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
    const ip = (ipHeader.split(",")[0]?.trim() || "0.0.0.0") + "";
    const ipHash = sha256(ip);

    // Сессия/роль
    const sessionUser = await getSessionUser();
    const userId = sessionUser?.id ?? null;

    const userRow = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, isBanned: true, bannedUntil: true, banReason: true },
        })
      : null;

    // Иммунитет для ADMIN/EDITOR/AUTHOR
    const privileged = !!userRow && (["ADMIN", "EDITOR", "AUTHOR"] as const).includes(userRow.role as any);

    const commentText: string = (text ?? bodyAlt ?? "").toString();

    // Honeypot: для обычных — «тихий» успех без записи
    if (!privileged && typeof hp === "string" && hp.trim().length > 0) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Базовая валидация
    if (!articleId || typeof commentText !== "string" || !commentText.trim()) {
      return NextResponse.json({ message: "Некорректные данные" }, { status: 400 });
    }

    // Настройки статьи (для всех)
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { commentsEnabled: true, commentsGuestsAllowed: true },
    });
    if (!article || !article.commentsEnabled) {
      return NextResponse.json({ message: "Комментарии отключены" }, { status: 403 });
    }
    if (!userId && article.commentsGuestsAllowed === false) {
      return NextResponse.json({ message: "Только для авторизованных" }, { status: 403 });
    }

    // Антибот-токен (для обычных)
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
        const expectSig = crypto
          .createHmac("sha256", secret)
          .update(`${token.issuedAt}:${uaHash}`)
          .digest("hex");
        if (token.sig !== expectSig) {
          return NextResponse.json({ message: "Недействительный токен" }, { status: 400 });
        }
      }
    }

    // Бан зарегистрированного (для обычных)
    if (userId && !privileged) {
      const now = new Date();
      if (userRow && (userRow.isBanned || (userRow.bannedUntil && userRow.bannedUntil > now))) {
        const reason = userRow.banReason ? ` Причина: ${userRow.banReason}` : "";
        const untilStr = userRow.bannedUntil ? ` До: ${new Date(userRow.bannedUntil).toLocaleString("ru-RU")}.` : "";
        return NextResponse.json(
          { message: `Ваш аккаунт заблокирован.${reason}${untilStr}`.trim() },
          { status: 403 }
        );
      }
    }

    // Корректность родителя
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

    // Гостевые данные + бан гостя
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
        const rsn = guestBan.reason ? ` Причина: ${guestBan.reason}.` : "";
        const unt = guestBan.until ? ` До: ${new Date(guestBan.until).toLocaleString("ru-RU")}.` : "";
        return NextResponse.json(
          { message: `Вы заблокированы.${rsn}${unt}`.trim() },
          { status: 403 }
        );
      }
    }

    // Текст
    const safeBody = commentText.replace(/\r/g, "").trim().slice(0, 2000);

    // Антиспам-лимиты/дубликаты (для обычных)
    if (!privileged) {
      // 30 сек между комментариями с одного ipHash
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

      // Почасовой лимит
      const recentHour = await prisma.comment.count({
        where: {
          ...(userId ? { authorId: userId } : { ipHash }),
          createdAt: { gt: new Date(Date.now() - 3600 * 1000) },
        },
      });
      const limitHour = userId ? 60 : 10;
      if (recentHour >= limitHour) {
        return NextResponse.json({ message: "Превышен лимит сообщений за час." }, { status: 429 });
      }

      // Дубликаты (10 минут)
      const dup = await prisma.comment.findFirst({
        where: { ipHash, body: safeBody, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json({ message: "Похоже на дубликат сообщения." }, { status: 409 });
      }
    }

    // 🚫 Автомодерация: блокируем с указанием проблемного фрагмента (для обычных)
    if (!privileged) {
      const violation = findViolation(safeBody);
      if (violation) {
        if (violation.rule === "profanity") {
          return NextResponse.json(
            { message: `Комментарий нарушает правила: нецензурная лексика — «${violation.snippet}». Исправьте текст и попробуйте снова.` },
            { status: 422 }
          );
        }
        if (violation.rule === "spam") {
          return NextResponse.json(
            { message: `Комментарий нарушает правила: спам/реклама — «${violation.snippet}». Исправьте текст и попробуйте снова.` },
            { status: 422 }
          );
        }
        if (violation.rule === "too_many_links") {
          const count = violation.extra?.count ?? 0;
          return NextResponse.json(
            { message: `Комментарий нарушает правила: слишком много ссылок (${count}). Пример: «${violation.snippet}».` },
            { status: 422 }
          );
        }
      }
    }

    // Создание комментария (всегда PUBLISHED)
    const created = await prisma.comment.create({
      data: {
        articleId,
        parentId: parentId ?? null,
        body: safeBody,
        authorId: userId,
        isGuest: !userId,
        guestName: gName || null,
        guestEmail: gEmail || null,
        status: "PUBLISHED",
        ipHash,
        userAgent: ua.slice(0, 500),
      },
      select: { id: true },
    });

    // Аудит: логируем текст нового комментария
    await auditLog({
      action: "COMMENT_CREATE",
      targetType: "ARTICLE",
      targetId: articleId,
      summary: `Комментарий создан (${created.id})`,
      detail: {
        commentId: created.id,
        articleId,
        parentId: parentId ?? null,
        isGuest: !userId,
        authorId: userId ?? null,
        guestName: !userId ? (gName || null) : null,
        body: safeBody,
      },
      actorId: userId,
      ipHash,
      userAgent: ua,
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return NextResponse.json({ message: "Внутренняя ошибка" }, { status: 500 });
  }
}
