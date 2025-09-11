// src/app/api/auth/callback/vk/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const site = process.env.NEXTAUTH_URL || "https://localhost";
  const target = new URL("/auth/signin/vkid/callback", site);

  const incoming = new URL(req.url);
  incoming.searchParams.forEach((v, k) => {
    target.searchParams.set(k, v);
  });

  return NextResponse.redirect(target.toString(), { status: 302 });
}
