"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { prisma } from "../../../lib/db";
import { getSessionUser } from "../../../lib/session";

function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT ?? "";
  return crypto.createHash("sha256").update(`${ip}|${salt}`).digest("hex");
}

export async function addComment(formData: FormData) {
  try {
    const articleId = String(formData.get("articleId") || "");
    const slug = String(formData.get("slug") || "");
    const bodyRaw = String(formData.get("body") || "");
    const guestName = String(formData.get("guestName") || "");
    const honeypot = String(formData.get("website") || "");

    if (honeypot) return { ok: false as const, error: "Bot detected" };

    const body = bodyRaw.replace(/\r\n/g, "\n").trim();
    if (!articleId || !slug) return { ok: false as const, error: "Некорректные параметры." };
    if (body.length < 1 || body.length > 2000) {
      return { ok: false as const, error: "Комментарий: 1–2000 символов." };
    }

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { commentsEnabled: true, commentsGuestsAllowed: true },
    });
    if (!article) return { ok: false as const, error: "Статья не найдена." };

    if (!article.commentsEnabled) {
      return { ok: false as const, error: "Комментарии отключены для этой статьи." };
    }

    const user = await getSessionUser();
    const role = user?.role || "READER";
    const isPrivileged = ["ADMIN", "EDITOR", "AUTHOR"].includes(role);

    if (!user?.id && !article.commentsGuestsAllowed) {
      return { ok: false as const, error: "Комментировать могут только авторизованные пользователи." };
    }

    if (user?.id) {
      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true },
      });
      if (!profile?.name || profile.name.trim().length < 2) {
        return {
          ok: false as const,
          error: "В профиле не указано имя. Укажите имя в аккаунте — оно отображается на сайте.",
        };
      }
    } else {
      if (guestName.trim().length < 2 || guestName.trim().length > 120) {
        return { ok: false as const, error: "Имя гостя: 2–120 символов." };
      }
    }

    const h = await headers();
    const ip = (h.get("x-forwarded-for") || "").split(",")[0]?.trim() || "0.0.0.0";
    const ua = h.get("user-agent") || "";
    const ipH = hashIp(ip);

    if (!isPrivileged) {
      const windowMs = 60_000;
      const since = new Date(Date.now() - windowMs);

      const recent = await prisma.comment.findFirst({
        where: user?.id
          ? { authorId: user.id, createdAt: { gte: since } }
          : { isGuest: true, guestName: guestName.trim(), userAgent: ua, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      if (recent) {
        const elapsed = Date.now() - +recent.createdAt;
        const leftSec = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
        return {
          ok: false as const,
          error: `Можно комментировать не чаще 1 раза в минуту. Подождите ${leftSec} сек.`,
        };
      }
    }

    await prisma.comment.create({
      data: {
        articleId,
        authorId: user?.id ?? null,
        isGuest: !user?.id,
        guestName: user?.id ? null : guestName.trim().slice(0, 120),
        body: body.slice(0, 2000),
        status: "PUBLISHED",
        ipHash: ipH,
        userAgent: ua.slice(0, 500),
      },
    });

    revalidatePath(`/news/${encodeURIComponent(slug)}`);
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Не удалось отправить комментарий." };
  }
}