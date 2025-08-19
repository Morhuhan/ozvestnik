// src/app/api/admin/media/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { requireRole } from "../../../../../../lib/session";
import { deleteResource } from "../../../../../../lib/yadisk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireRole(["EDITOR", "ADMIN"]); // добавь "AUTHOR", если нужно
  const { id } = await ctx.params;

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return jsonError("NOT_FOUND", 404);

  // Удаляем файл на Я.Диске (в корзину)
  try {
    await deleteResource(asset.yandexPath);
  } catch (e: any) {
    return jsonError(e?.message || "Disk delete failed", 502);
  }

  // Удаляем запись из БД
  await prisma.mediaAsset.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
