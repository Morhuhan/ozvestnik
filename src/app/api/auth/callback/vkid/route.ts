import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, userId } = body;

    if (!accessToken || !userId) {
      return NextResponse.redirect(
        new URL("/auth/signin?error=MissingCredentials", request.url)
      );
    }

    const callbackUrl = new URL("/api/auth/callback/credentials", request.url);
    callbackUrl.searchParams.set("accessToken", accessToken);
    callbackUrl.searchParams.set("userId", userId);
    
    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    console.error("VK ID callback error:", error);
    return NextResponse.redirect(
      new URL("/auth/signin?error=CallbackError", request.url)
    );
  }
}