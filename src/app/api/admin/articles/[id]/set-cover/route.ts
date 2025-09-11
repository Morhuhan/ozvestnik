import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/db";
import { requireRole } from "../../../../../../../lib/session";

export async function POST(req: NextRequest, ctx: any) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const { id } = (ctx as { params: { id: string } }).params;

  const form = await req.formData();
  const coverUrl = String(form.get("coverUrl") || "");

  if (!coverUrl) {
    return NextResponse.json(
      { ok: false, error: "coverUrl is required" },
      { status: 400 }
    );
    }

  await prisma.article.update({
    where: { id },
    data: { coverUrl },
  });

  return NextResponse.json({ ok: true });
}
