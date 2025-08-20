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
    if (body.length < 1 || body.length > 3000) {
      return { ok: false as const, error: "Комментарий: 1–3000 символов." };
    }

    const user = await getSessionUser();

    // имя обязательно
    if (user?.id) {
      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, role: true },
      });

      if (!profile?.name || profile.name.trim().length < 2) {
        return {
          ok: false as const,
          error:
            "В профиле не указано имя. Укажите его в настройках — оно будет отображаться на сайте.",
        };
      }

      // 🚫 Ограничение пропускаем для ADMIN / EDITOR / AUTHOR
      if (!["ADMIN", "EDITOR", "AUTHOR"].includes(profile.role)) {
        const windowMs = 60_000;
        const since = new Date(Date.now() - windowMs);

        const recent = await prisma.comment.findFirst({
          where: { authorId: user.id, createdAt: { gte: since } },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
        });

        if (recent) {
          const elapsed = Date.now() - new Date(recent.createdAt).getTime();
          const leftSec = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
          return {
            ok: false as const,
            error: `Можно комментировать не чаще 1 раза в минуту. Подождите ${leftSec} сек.`,
          };
        }
      }
    } else {
      // Гость: имя обязательно
      if (guestName.trim().length < 2) {
        return { ok: false as const, error: "Для гостя укажите имя (не короче 2 символов)." };
      }

      const h = await headers();
      const ua = h.get("user-agent") || "";

      const windowMs = 60_000;
      const since = new Date(Date.now() - windowMs);

      const recent = await prisma.comment.findFirst({
        where: {
          isGuest: true,
          guestName: guestName.trim(),
          userAgent: ua,
          createdAt: { gte: since },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      if (recent) {
        const elapsed = Date.now() - new Date(recent.createdAt).getTime();
        const leftSec = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
        return {
          ok: false as const,
          error: `Можно комментировать не чаще 1 раза в минуту. Подождите ${leftSec} сек.`,
        };
      }
    }

    // ───────────────────────────────────────────────
    // сохраняем комментарий
    const h = await headers();
    const ip = (h.get("x-forwarded-for") || "").split(",")[0]?.trim() || "0.0.0.0";
    const ua = h.get("user-agent") || "";
    const ipH = hashIp(ip);

    await prisma.comment.create({
      data: {
        articleId,
        authorId: user?.id ?? null,
        isGuest: !user?.id,
        guestName: user?.id ? null : guestName.trim().slice(0, 80),
        body,
        status: "PUBLISHED",
        ipHash: ipH,
        userAgent: ua.slice(0, 255),
      },
    });

    revalidatePath(`/news/${encodeURIComponent(slug)}`);
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Не удалось отправить комментарий." };
  }
}
