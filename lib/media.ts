// lib/media.ts
import { prisma } from "./db";
import { getUploadLink, putToHref, publish, getResourceMeta, getPublicDownloadHref } from "./yadisk";
import { randomUUID } from "crypto";

export function buildYandexPath(originalName: string, now = new Date()) {
  const base = process.env.MEDIA_BASE_DIR || "disk:/media";
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const safe = originalName.replace(/[^\w.\-]+/g, "_").toLowerCase();
  const uid = randomUUID().slice(0, 8);
  return `${base}/${yyyy}/${mm}/${uid}-${safe}`;
}

export async function ensureDownloadHref(publicKey: string) {
  const href = await getPublicDownloadHref(publicKey);
  const ttlMin = Number(process.env.MEDIA_PUBLIC_CACHE_TTL_MIN || "60");
  const expires = new Date(Date.now() + ttlMin * 60 * 1000);
  return { href, expires };
}

export function kindOf(mime: string): "IMAGE" | "VIDEO" | "OTHER" {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  return "OTHER";
}
