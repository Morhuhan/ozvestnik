// src/app/api/admin/media/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { requireRole } from "../../../../../../lib/session";
import { deleteResource } from "../../../../../../lib/yadisk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsP = Promise<{ id: string }>;

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// DELETE: удалить ресурс и запись в БД
export async function DELETE(_req: NextRequest, ctx: { params: ParamsP }) {
  await requireRole(["EDITOR", "ADMIN"]); // добавь "AUTHOR", если нужно
  const { id } = await ctx.params;

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return jsonError("NOT_FOUND", 404);

  try {
    await deleteResource(asset.yandexPath); // в корзину
  } catch (e: any) {
    return jsonError(e?.message || "Disk delete failed", 502);
  }

  await prisma.mediaAsset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// PATCH: обновить ТОЛЬКО метаданные (title/alt). Имя файла на сервере НЕ меняем.
export async function PATCH(req: NextRequest, ctx: { params: ParamsP }) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);
  const { id } = await ctx.params;

  let body: { title?: string | null; alt?: string | null };
  try {
    body = await req.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return jsonError("NOT_FOUND", 404);

  // Формируем патч. Разрешаем только title/alt.
  const data: Record<string, any> = {};
  if (typeof body.title !== "undefined") data.title = body.title ?? null;
  if (typeof body.alt !== "undefined") data.alt = body.alt ?? null;

  // Если вдруг пришли пустые обновления — вернём текущий объект.
  if (Object.keys(data).length === 0) {
    return NextResponse.json({
      ok: true,
      asset: {
        id: asset.id,
        filename: asset.filename,
        title: asset.title,
        alt: asset.alt,
        yandexPath: asset.yandexPath,
      },
    });
  }

  const updated = await prisma.mediaAsset.update({
    where: { id: asset.id },
    data,
    select: {
      id: true,
      filename: true,
      title: true,
      alt: true,
      yandexPath: true,
    },
  });

  return NextResponse.json({ ok: true, asset: updated });
}
