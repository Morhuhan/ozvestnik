// src/app/admin/media/[id]/raw/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { publish, getResourceMeta, getPublicDownloadHref, getPrivateDownloadHref } from "../../../../../../lib/yadisk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// сколько держим кэш downloadHref (секунды)
const TTL_SECONDS = 9 * 60; // 9 минут

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let publicKey = asset.publicKey ?? null;

  // 1) Если нет publicKey — пытаемся опубликовать и перечитать мету
  if (!publicKey) {
    try { await publish(asset.yandexPath); } catch {}
    try {
      const meta: any = await getResourceMeta(asset.yandexPath, "public_key,public_url");
      if (meta?.public_key) {
        publicKey = String(meta.public_key);
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { publicKey, publicUrl: (meta.public_url as string) ?? null },
        });
      }
    } catch {}
  }

  // 2) Если в БД есть живой кэш ссылки — редиректим сразу
  const now = Date.now();
  if (asset.downloadHref && asset.downloadHrefExpiresAt && asset.downloadHrefExpiresAt.getTime() > now) {
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: asset.downloadHref,
        "Cache-Control": "private, max-age=30",
      },
    });
  }

  // 3) Пробуем получить PUBLIC download href по publicKey
  let href: string | null = null;
  let source: "public" | "private" | null = null;

  if (publicKey) {
    try {
      href = await getPublicDownloadHref(publicKey);
      source = "public";
    } catch (e) {
      // упало — пойдём в приватный фолбэк ниже
      // console.warn("[raw] public download failed:", e);
    }
  }

  // 4) Фолбэк: приватная ссылка по path
  if (!href) {
    try {
      href = await getPrivateDownloadHref(asset.yandexPath);
      source = "private";
    } catch (e) {
      // Совсем не удалось — отдаём понятную ошибку
      return NextResponse.json({ error: "NO_DOWNLOAD_HREF" }, { status: 502 });
    }
  }

  // 5) Сохраняем кэш downloadHref + TTL
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: { downloadHref: href, downloadHrefExpiresAt: expiresAt },
  });

  // 6) Редиректим на раздачу Я.Диска
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: href!,
      // этот 302 можно слегка кэшировать браузером
      "Cache-Control": "private, max-age=30",
      "X-Download-Source": source ?? "unknown",
    },
  });
}
