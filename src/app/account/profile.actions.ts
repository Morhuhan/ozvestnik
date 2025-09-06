"use server";

import { prisma } from "../../../lib/db";
import { getSessionUser } from "../../../lib/session";
import {
  getUploadLinkEnsuring,
  putToHref,
  publish,
  getResourceMeta,
} from "../../../lib/yadisk";

export type ActionResult = { ok: true } | { ok: false; error: string };

const NAME_MIN = 2;
const NAME_MAX = 80;
const NAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function fmtLeft(ms: number) {
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} дн. ${h} ч.`;
  if (h > 0) return `${h} ч. ${m} мин.`;
  return `${Math.max(m, 1)} мин.`;
}

function extFromMime(mime: string) {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/jpeg":
    case "image/jpg":
    default:
      return "jpg";
  }
}

export async function saveProfile(formData: FormData): Promise<ActionResult> {
  try {
    const auth = await getSessionUser();
    if (!auth?.id) return { ok: false, error: "Необходима авторизация." };

    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: { id: true, name: true, image: true, nameChangedAt: true },
    });
    if (!user) return { ok: false, error: "Пользователь не найден." };

    const nextName = String(formData.get("name") || "").trim();
    const bio = String(formData.get("bio") || "").trim();
    const removeAvatar = String(formData.get("removeAvatar") || "") === "1";
    const file = formData.get("avatar") as File | null;

    if (nextName.length < NAME_MIN || nextName.length > NAME_MAX) {
      return { ok: false, error: `Имя: ${NAME_MIN}–${NAME_MAX} символов.` };
    }

    const isNameChanged = nextName !== (user.name || "").trim();
    const role = auth.role || "READER";
    const isPrivileged = ["ADMIN", "EDITOR", "AUTHOR"].includes(role);

    if (isNameChanged && !isPrivileged && user.nameChangedAt) {
      const left = user.nameChangedAt.getTime() + NAME_COOLDOWN_MS - Date.now();
      if (left > 0) {
        return { ok: false, error: `Имя можно менять не чаще, чем раз в неделю. Подождите ещё ${fmtLeft(left)}.` };
      }
    }

    let imageUrl: string | null = user.image || null;

    if (removeAvatar) {
      imageUrl = null;
    }

    if (!removeAvatar && file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
      if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Файл больше 2 МБ." };

      const mime = (file.type || "").toLowerCase();
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(mime)) {
        return { ok: false, error: "Поддерживаются PNG, JPEG, WEBP, GIF." };
      }

      const ext = extFromMime(mime);
      const diskPath = `disk:/app/avatars/${auth.id}/avatar.${ext}`;

      const href = await getUploadLinkEnsuring(diskPath, true);
      const ab = await file.arrayBuffer();
      await putToHref(href, ab);

      await publish(diskPath);

      const meta = (await getResourceMeta(diskPath, "public_key")) as { public_key?: string };

      if (!meta.public_key) {
        return { ok: false, error: "Не удалось опубликовать аватар." };
      }

      // Храним стабильный URL на наш прокси-роут,
      // который каждый раз выдаёт свежую download-ссылку.
      const pk = encodeURIComponent(meta.public_key);
      imageUrl = `/api/yadisk-public?pk=${pk}`;
    }

    await prisma.user.update({
      where: { id: auth.id },
      data: {
        name: nextName,
        bio: bio || null,
        image: imageUrl,
        ...(isNameChanged ? { nameChangedAt: new Date() } : {}),
      },
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Не удалось сохранить профиль." };
  }
}
