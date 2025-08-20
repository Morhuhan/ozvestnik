"use server";

import path from "node:path";
import { promises as fs } from "node:fs";
import { prisma } from "../../../lib/db";
import { getSessionUser } from "../../../lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const NAME_MIN = 2;
const NAME_MAX = 80;
const NAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 суток

function fmtLeft(ms: number) {
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} дн. ${h} ч.`;
  if (h > 0) return `${h} ч. ${m} мин.`;
  return `${Math.max(m, 1)} мин.`;
}

/**
 * Единая server action для сохранения профиля.
 * Принимает FormData с полями:
 * - name: string (обязательно)
 * - bio: string (опционально)
 * - avatar: File (опционально) — изображение до 2 МБ
 * - removeAvatar: "1" | "" — флаг удаления текущего аватара
 *
 * Кулдаун на смену имени 7 дней действует ТОЛЬКО для гостей и роли READER.
 * Роли ADMIN / EDITOR / AUTHOR меняют имя без ограничений.
 */
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

    // ⛔️ Кулдаун только для READER (и по сути для не-привилегированных)
    if (isNameChanged && !isPrivileged && user.nameChangedAt) {
      const left = user.nameChangedAt.getTime() + NAME_COOLDOWN_MS - Date.now();
      if (left > 0) {
        return {
          ok: false,
          error: `Имя можно менять не чаще, чем раз в неделю. Подождите ещё ${fmtLeft(left)}.`,
        };
      }
    }

    let imageUrl: string | null = user.image || null;

    // Удаление аватара по флагу
    if (removeAvatar) {
      imageUrl = null;
    }

    // Если пришёл файл — валидируем и сохраняем в /public/avatars
    if (file && typeof file === "object" && "arrayBuffer" in file) {
      if (file.size > 0) {
        if (file.size > 2 * 1024 * 1024) {
          return { ok: false, error: "Файл больше 2 МБ." };
        }
        const mime = (file.type || "").toLowerCase();
        if (!/^image\/(png|jpe?g|webp|gif)$/.test(mime)) {
          return { ok: false, error: "Поддерживаются PNG, JPEG, WEBP, GIF." };
        }

        const ext =
          mime === "image/png"
            ? "png"
            : mime === "image/webp"
            ? "webp"
            : mime === "image/gif"
            ? "gif"
            : "jpg";

        const ts = Date.now();
        const filename = `${auth.id}-${ts}.${ext}`;

        const publicDir = path.join(process.cwd(), "public");
        const avatarsDir = path.join(publicDir, "avatars");
        await fs.mkdir(avatarsDir, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(path.join(avatarsDir, filename), buffer, { flag: "w" });

        imageUrl = `/avatars/${filename}`;
      }
    }

    await prisma.user.update({
      where: { id: auth.id },
      data: {
        name: nextName,
        bio: bio || null,
        image: imageUrl,
        // Обновляем метку только если имя действительно изменилось
        ...(isNameChanged ? { nameChangedAt: new Date() } : {}),
      },
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Не удалось сохранить профиль." };
  }
}
