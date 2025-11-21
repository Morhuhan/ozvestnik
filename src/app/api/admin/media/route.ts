//C:\Users\radio\Projects\ozerskiy-vestnik\src\app\api\admin\media\route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { requireRole } from "../../../../../lib/session";
import type { MediaKind } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(v: string | null, def: number) {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
}

const ALL_KINDS: MediaKind[] = ["IMAGE", "VIDEO", "OTHER"];

function parseKinds(v: string | null): MediaKind[] | undefined {
  if (!v) return undefined;
  const set = new Set(
    v
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
  const out: MediaKind[] = [];
  for (const k of ALL_KINDS) if (set.has(k)) out.push(k);
  return out.length ? out : undefined;
}

export async function GET(req: NextRequest) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const { searchParams } = new URL(req.url);
  const page = toInt(searchParams.get("page"), 1);
  const limit = Math.min(toInt(searchParams.get("limit"), 40), 100);
  const kinds = parseKinds(searchParams.get("kinds"));
  const q = (searchParams.get("q") || "").trim();

  const where: any = {};
  const AND: any[] = [];
  if (kinds && kinds.length) AND.push({ kind: { in: kinds } });
  if (q) {
    AND.push({
      OR: [
        { filename: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { mime: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (AND.length) where.AND = AND;

  const skip = (page - 1) * limit;

  const rows = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit + 1,
    select: {
      id: true,
      kind: true,
      mime: true,
      filename: true,
      title: true,
      alt: true,
      createdAt: true,
      width: true,
      height: true,
      durationSec: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json(
    {
      items,
      page,
      limit,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}