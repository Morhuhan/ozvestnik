import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/db";
import { requireRole } from "../../../../../../../lib/session";

export const POST = async (req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole(["AUTHOR","EDITOR","ADMIN"]);
  const form = await req.formData();
  const coverUrl = String(form.get("coverUrl") || "");
  await prisma.article.update({ where: { id: params.id }, data: { coverUrl } });
  return NextResponse.json({ ok: true });
};
