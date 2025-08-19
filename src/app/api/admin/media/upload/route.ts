// src/app/api/admin/media/upload/route.ts

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { buildYandexPath, ensureDownloadHref, kindOf } from "../../../../../../lib/media";
import { requireRole } from "../../../../../../lib/session";
import { getUploadLinkEnsuring, putToHref, publish, getResourceMeta } from "../../../../../../lib/yadisk";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wantsHtml(req: NextRequest) {
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/html");
}

function backUrl(req: NextRequest, params?: Record<string, string>) {
  const url = new URL("/admin/media", req.url);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

function jsonError(stage: string, message: string, status = 500) {
  return NextResponse.json(
    { ok: false, error: { code: "UPLOAD_FAILED", stage, message } },
    { status }
  );
}

export async function POST(req: NextRequest) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  if (!process.env.YADISK_OAUTH_TOKEN) {
    const msg = "Переменная окружения YADISK_OAUTH_TOKEN не задана.";
    return wantsHtml(req)
      ? NextResponse.redirect(backUrl(req, { error: msg }), 303)
      : jsonError("CONFIG", msg, 500);
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const title = (form.get("title") as string) || null;
    const alt = (form.get("alt") as string) || null;
    const caption = (form.get("caption") as string) || null;

    if (!file) {
      const msg = "Не передан файл (form-data поле: file).";
      return wantsHtml(req)
        ? NextResponse.redirect(backUrl(req, { error: msg }), 303)
        : jsonError("VALIDATION", msg, 400);
    }

    // 1) путь на Я.Диске
    const yPath = buildYandexPath(file.name);

    // 2) загрузка байтов
    let uploadHref: string;
    try {
      uploadHref = await getUploadLinkEnsuring(yPath, true);
    } catch (e: any) {
      const msg = e?.message || "Не удалось получить upload href";
      return wantsHtml(req)
        ? NextResponse.redirect(backUrl(req, { error: msg }), 303)
        : jsonError("UPLOAD_LINK", msg);
    }

    try {
      await putToHref(uploadHref, file); // File/Blob — ОК
    } catch (e: any) {
      const msg =
        e?.message ||
        "Не удалось загрузить файл на временный адрес. Возможна блокировка сети/прокси.";
      return wantsHtml(req)
        ? NextResponse.redirect(backUrl(req, { error: msg }), 303)
        : jsonError("PUT_BYTES", msg);
    }

    // 3) публикация
    try {
      await publish(yPath);
    } catch (e: any) {
      const msg = e?.message || "Не удалось опубликовать ресурс";
      return wantsHtml(req)
        ? NextResponse.redirect(backUrl(req, { error: msg }), 303)
        : jsonError("PUBLISH", msg);
    }

    // 4) метаданные
    let meta: any;
    try {
      meta = await getResourceMeta(yPath, "name,mime_type,size,public_url,public_key");
    } catch (e: any) {
      const msg = e?.message || "Не удалось получить метаданные ресурса";
      return wantsHtml(req)
        ? NextResponse.redirect(backUrl(req, { error: msg }), 303)
        : jsonError("META", msg);
    }

    const publicKey: string | undefined = meta?.public_key;
    const publicUrl: string | undefined = meta?.public_url;
    const mime = (meta?.mime_type as string) || file.type || "application/octet-stream";
    const size =
      typeof meta?.size === "number" ? (meta.size as number) : file.size || null;

    // 5) кэш download href (best-effort)
    let downloadHref: string | null = null;
    let downloadHrefExpiresAt: Date | null = null;
    if (publicKey) {
      try {
        const { href, expires } = await ensureDownloadHref(publicKey);
        downloadHref = href;
        downloadHrefExpiresAt = expires;
      } catch {
        // ignore
      }
    }

    // 6) запись в БД
    const asset = await prisma.mediaAsset.create({
      data: {
        kind: kindOf(mime) as any,
        mime,
        filename: file.name,
        ext: file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : null,
        size: size ?? null,
        yandexPath: yPath,
        publicUrl: publicUrl ?? null,
        publicKey: publicKey ?? null,
        downloadHref,
        downloadHrefExpiresAt,
        title,
        alt,
        caption,
      },
    });

    // 7) Ответ
    if (wantsHtml(req)) {
      // обычная отправка формы → редирект обратно в админку
      return NextResponse.redirect(
        backUrl(req, { toast: "Файл загружен" }),
        303
      );
    }

    const stableUrl = `/admin/media/${asset.id}/raw`; // т.к. raw-роут сейчас под /admin
    return NextResponse.json({ ok: true, asset: { ...asset, stableUrl } });
  } catch (e: any) {
    const msg = e?.message || "Неизвестная ошибка";
    return wantsHtml(req)
      ? NextResponse.redirect(backUrl(req, { error: msg }), 303)
      : jsonError("UNEXPECTED", msg);
  }
}