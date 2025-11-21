//C:\Users\radio\Projects\ozerskiy-vestnik\src\app\admin\media\[id]\raw\route.ts
import { NextRequest } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { publish, getResourceMeta, getPublicDownloadHref, getPrivateDownloadHref } from "../../../../../../lib/yadisk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsP = Promise<{ id: string }>;

const hrefCache = new Map<string, { href: string; expires: Date }>();

async function getCachedOrFreshHref(
  assetId: string,
  yandexPath: string,
  publicKey: string | null,
  dbDownloadHref: string | null,
  dbExpiresAt: Date | null,
  size?: string
): Promise<string> {
  const cacheKey = size ? `${assetId}:${size}` : assetId;
  const now = new Date();

  const cached = hrefCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.href;
  }

  if (!size && dbDownloadHref && dbExpiresAt && dbExpiresAt > now) {
    hrefCache.set(cacheKey, { href: dbDownloadHref, expires: dbExpiresAt });
    return dbDownloadHref;
  }

  let href: string;
  if (publicKey) {
    href = await getPublicDownloadHref(publicKey);
    if (size) {
      const url = new URL(href);
      url.searchParams.set('preview', '');
      url.searchParams.set('size', size);
      href = url.toString();
    }
  } else {
    href = await getPrivateDownloadHref(yandexPath);
  }

  const expires = new Date(Date.now() + 23 * 60 * 60 * 1000);

  if (!size) {
    prisma.mediaAsset.update({
      where: { id: assetId },
      data: { 
        downloadHref: href,
        downloadHrefExpiresAt: expires 
      }
    }).catch(err => console.error('Failed to cache download href:', err));
  }

  hrefCache.set(cacheKey, { href, expires });

  return href;
}

function buildResponse(
  upstream: Response, 
  asset: { mime: string | null; filename: string; kind: string },
  range?: string,
  size?: string
) {
  const headers = new Headers();
  
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? asset.mime ?? "application/octet-stream"
  );

  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

  headers.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(asset.filename)}"`
  );

  const maxAge = size ? 2592000 : (asset.kind === "IMAGE" ? 31536000 : 3600);
  headers.set(
    "Cache-Control",
    size 
      ? `public, max-age=${maxAge}, immutable`
      : asset.kind === "IMAGE"
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600, stale-while-revalidate=86400"
  );

  return new Response(upstream.body, {
    status: contentRange ? 206 : 200,
    headers,
  });
}

export async function GET(req: NextRequest, { params }: { params: ParamsP }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const size = searchParams.get("size") || undefined;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      mime: true,
      filename: true,
      yandexPath: true,
      publicKey: true,
      downloadHref: true,
      downloadHrefExpiresAt: true,
    },
  });

  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  if (size && asset.kind !== "IMAGE") {
    return new Response("Preview only available for images", { status: 400 });
  }

  let publicKey = asset.publicKey;
  if (!publicKey) {
    try {
      await publish(asset.yandexPath);
      const meta: any = await getResourceMeta(asset.yandexPath, "public_key");
      if (meta?.public_key) {
        publicKey = String(meta.public_key);
        prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { publicKey }
        }).catch(err => console.error('Failed to save publicKey:', err));
      }
    } catch (err) {
      console.error('Failed to publish resource:', err);
    }
  }

  try {
    const href = await getCachedOrFreshHref(
      asset.id,
      asset.yandexPath,
      publicKey,
      asset.downloadHref,
      asset.downloadHrefExpiresAt,
      size
    );

    const range = req.headers.get("range") ?? undefined;

    const upstream = await fetch(href, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
    });

    if ((upstream.status === 401 || upstream.status === 403) && !range) {
      const freshHref = publicKey 
        ? await getPublicDownloadHref(publicKey)
        : await getPrivateDownloadHref(asset.yandexPath);
      
      let finalHref = freshHref;
      if (size && publicKey) {
        const url = new URL(freshHref);
        url.searchParams.set('preview', '');
        url.searchParams.set('size', size);
        finalHref = url.toString();
      }
      
      const freshExpires = new Date(Date.now() + 23 * 60 * 60 * 1000);
      const cacheKey = size ? `${asset.id}:${size}` : asset.id;
      hrefCache.set(cacheKey, { href: finalHref, expires: freshExpires });
      
      if (!size) {
        prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { 
            downloadHref: freshHref,
            downloadHrefExpiresAt: freshExpires 
          }
        }).catch(err => console.error('Failed to update download href:', err));
      }

      const retryUpstream = await fetch(finalHref, {
        headers: range ? { Range: range } : undefined,
        cache: "no-store",
      });

      if (!retryUpstream.ok && retryUpstream.status !== 206) {
        return new Response(`Upstream ${retryUpstream.status}`, { status: 502 });
      }

      return buildResponse(retryUpstream, asset, range, size);
    }

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`Upstream ${upstream.status}`, { status: 502 });
    }

    return buildResponse(upstream, asset, range, size);

  } catch (error) {
    console.error('Error serving media:', error);
    return new Response("Internal Server Error", { status: 500 });
  }
}