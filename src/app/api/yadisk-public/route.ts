// src/app/api/yadisk-public/route.ts
import { NextRequest } from "next/server";
import { getPublicDownloadHref } from "../../../../lib/yadisk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const pk = url.searchParams.get("pk");
  if (!pk) return new Response("Missing pk", { status: 400 });

  const range = req.headers.get("range") ?? undefined;

  const href = await getPublicDownloadHref(pk);
  const upstream = await fetch(href, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream ${upstream.status}`, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  const cr = upstream.headers.get("content-range");
  if (cr) headers.set("Content-Range", cr);
  const ar = upstream.headers.get("accept-ranges");
  if (ar) headers.set("Accept-Ranges", ar);
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=0, no-store, must-revalidate");

  return new Response(upstream.body, { status: cr ? 206 : 200, headers });
}
