import { NextRequest, NextResponse } from "next/server";
import { getPublicDownloadHref } from "../../../../lib/yadisk";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pk = searchParams.get("pk");
    if (!pk) return new NextResponse("Missing pk", { status: 400 });

    // Берём свежий временный href и редиректим на него
    const href = await getPublicDownloadHref(pk);
    // 302 достаточен: браузер последует на downlad-URL Я.Диска
    return NextResponse.redirect(href, { status: 302 });
  } catch (e: any) {
    return new NextResponse(e?.message || "Failed to resolve Yandex Disk URL", { status: 500 });
  }
}
