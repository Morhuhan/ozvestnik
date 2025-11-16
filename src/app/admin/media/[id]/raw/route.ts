// src/app/admin/media/[id]/raw/route.ts
import { NextRequest } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { publish, getResourceMeta, getPublicDownloadHref, getPrivateDownloadHref } from "../../../../../../lib/yadisk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParamsP = Promise<{ id: string }>;

async function getFreshHref(yandexPath: string, publicKey: string | null) {
  if (publicKey) return await getPublicDownloadHref(publicKey);
  return await getPrivateDownloadHref(yandexPath);
}

export async function GET(req: NextRequest, { params }: { params: ParamsP }) {
  const { id } = await params;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      mime: true,
      filename: true,
      yandexPath: true,
      publicKey: true,
    },
  });
  if (!asset) return new Response("Not found", { status: 404 });

  let publicKey = asset.publicKey ?? null;
  if (!publicKey) {
    try {
      await publish(asset.yandexPath);
      const meta: any = await getResourceMeta(asset.yandexPath, "public_key");
      if (meta?.public_key) {
        publicKey = String(meta.public_key);
        await prisma.mediaAsset.update({ where: { id: asset.id }, data: { publicKey } });
      }
    } catch {}
  }

  const range = req.headers.get("range") ?? undefined;

  let href = await getFreshHref(asset.yandexPath, publicKey);
  let upstream = await fetch(href, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
  });

  if ((upstream.status === 401 || upstream.status === 403) && !range) {
    try {
      href = await getFreshHref(asset.yandexPath, publicKey);
      upstream = await fetch(href, {
        headers: range ? { Range: range } : undefined,
        cache: "no-store",
      });
    } catch {}
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream ${upstream.status}`, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? asset.mime ?? "application/octet-stream");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);
  headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(asset.filename)}"`);
  headers.set(
    "Cache-Control",
    asset.kind === "IMAGE" ? "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" : "public, max-age=600"
  );

  return new Response(upstream.body, { status: contentRange ? 206 : 200, headers });
}