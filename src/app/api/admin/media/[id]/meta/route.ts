//C:\Users\radio\Projects\ozerskiy-vestnik\src\app\api\admin\media\[id]\meta\route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsP = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: ParamsP }) {
  const { id } = await params;

  if (!id || typeof id !== "string" || id.length < 10) {
    return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
  }

  const a = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      mime: true,
      width: true,
      height: true,
      durationSec: true,
      title: true,
      alt: true,
      caption: true,
      ext: true,
    },
  });

  if (!a) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(a, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}