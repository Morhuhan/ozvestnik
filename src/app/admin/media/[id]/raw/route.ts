// src/app/admin/media/[id]/raw/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { ensureDownloadHref } from "../../../../../../lib/media";
import { publish, getResourceMeta, getPrivateDownloadHref } from "../../../../../../lib/yadisk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsP = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: ParamsP }) {
  const { id } = await params;

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let publicKey = asset.publicKey ?? null;

  // Если нет publicKey — публикуем (идемпотентно) и перечитываем метаданные
  if (!publicKey) {
    try {
      await publish(asset.yandexPath);
    } catch {
      /* ignore */
    }
    try {
      const meta: any = await getResourceMeta(asset.yandexPath, "public_key,public_url");
      if (meta?.public_key) {
        publicKey = String(meta.public_key);
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: {
            publicKey,
            publicUrl: (meta.public_url as string) ?? null,
          },
        });
      }
    } catch {
      /* ignore */
    }
  }

  // 1) Пробуем публичную временную ссылку (если есть publicKey)
  if (publicKey) {
    try {
      const fresh = await ensureDownloadHref(publicKey); // { href: string; expires: Date }
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { downloadHref: fresh.href, downloadHrefExpiresAt: fresh.expires },
      });

      // 302 редиректим на временную ссылку. Немного кэшируем сам редирект.
      return new NextResponse(null, {
        status: 302,
        headers: {
          Location: fresh.href,
          "Cache-Control": "private, max-age=30",
        },
      });
    } catch {
      // пойдём на приватный фолбэк ниже
    }
  }

  // 2) Фолбэк: приватная временная ссылка по path (OAuth)
  try {
    const href = await getPrivateDownloadHref(asset.yandexPath);
    const expires = new Date(Date.now() + 2 * 60 * 1000); // эвристический TTL 2 минуты

    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { downloadHref: href, downloadHrefExpiresAt: expires },
    });

    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: href,
        "Cache-Control": "private, max-age=20",
      },
    });
  } catch {
    return NextResponse.json({ error: "NO_DOWNLOAD_HREF" }, { status: 502 });
  }
}
