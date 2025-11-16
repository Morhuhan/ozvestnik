// lib/media.ts
import { prisma } from "./db";
import {
  getUploadLink,
  putToHref,
  publish,
  getResourceMeta,
  getPublicDownloadHref,
} from "./yadisk";
import { randomUUID } from "crypto";

// ───────────────────────── ЕДИНАЯ ТОЧКА ПРАВДЫ ПО ФОРМАТАМ ─────────────────────────

export type MediaKind = "IMAGE" | "VIDEO" | "OTHER";

export const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"] as const;
export const VIDEO_EXT = ["mp4", "webm", "mov", "m4v", "ogg"] as const;

export const IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
] as const;

export const VIDEO_MIME = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
  "video/x-m4v",
  "video/ogg",
] as const;

/** accept-строка для <input type="file" accept="…"> */
export function acceptForKinds(kinds: MediaKind[] = ["IMAGE", "VIDEO"]): string {
  const parts: string[] = [];
  if (kinds.includes("IMAGE")) {
    parts.push(...IMAGE_EXT.map((e) => `.${e}`), "image/*");
  }
  if (kinds.includes("VIDEO")) {
    parts.push(...VIDEO_EXT.map((e) => `.${e}`), "video/*");
  }
  return Array.from(new Set(parts)).join(",");
}

const toLower = (s?: string | null) =>
  (typeof s === "string" ? s : "").toLowerCase().trim();

export function guessExt(filename?: string | null): string | null {
  const f = toLower(filename);
  const i = f.lastIndexOf(".");
  if (i < 0) return null;
  return f.slice(i + 1);
}

export function kindOf(mime: string): MediaKind {
  const m = toLower(mime);
  if (m.startsWith("image/")) return "IMAGE";
  if (m.startsWith("video/")) return "VIDEO";
  return "OTHER";
}

/** Проверка, можно ли загружать файл с данным mime/ext */
export function isUploadAllowed(mime?: string | null, filename?: string | null): boolean {
  const m = toLower(mime);
  const ext = toLower(guessExt(filename));

  if ((IMAGE_MIME as readonly string[]).includes(m)) return true;
  if ((VIDEO_MIME as readonly string[]).includes(m)) return true;

  if ((IMAGE_EXT as readonly string[]).includes(ext)) return true;
  if ((VIDEO_EXT as readonly string[]).includes(ext)) return true;

  // сюда можно добавить PDF/документы, если понадобятся
  return false;
}

/** Универсальный хелпер для аплоада: вычисляет kind и нормализованный ext */
export function guessKindAndExt(
  mime?: string | null,
  filename?: string | null
): { kind: MediaKind; ext: string | null } {
  const kind = kindOf(toLower(mime || ""));
  let ext = guessExt(filename);

  if (!ext) {
    // пробуем по mime
    const m = toLower(mime);
    if (m === "image/svg+xml") ext = "svg";
    else if (m === "image/avif") ext = "avif";
    else if (m === "image/webp") ext = "webp";
    else if (m === "image/png") ext = "png";
    else if (m === "image/jpeg") ext = "jpg";
    else if (m === "video/mp4") ext = "mp4";
    else if (m === "video/webm") ext = "webm";
    else if (m === "video/quicktime") ext = "mov";
  }

  return { kind, ext };
}

// ─────────────────────────────────── Я.Диск / пути / ссылки ───────────────────────────────────

export function buildYandexPath(originalName: string, title?: string) {
  const ext = originalName.includes(".") ? originalName.split(".").pop()! : "";
  const sanitizedName = (title || originalName).replace(/[^a-zA-Z0-9а-яА-ЯёЁ.-]/g, "_");
  return `disk:/media/${sanitizedName}.${ext}`;
}

export async function ensureDownloadHref(publicKey: string) {
  const href = await getPublicDownloadHref(publicKey);
  const ttlMin = Number(process.env.MEDIA_PUBLIC_CACHE_TTL_MIN || "60");
  const expires = new Date(Date.now() + ttlMin * 60 * 1000);
  return { href, expires };
}
