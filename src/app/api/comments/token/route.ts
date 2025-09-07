// app/api/comments/token/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  const issuedAt = Date.now();

  const secret = process.env.COMMENT_TOKEN_SECRET || "";
  const uaHash = crypto.createHash("sha256").update(ua).digest("hex").slice(0, 32);
  const sig = secret
    ? crypto.createHmac("sha256", secret).update(`${issuedAt}:${uaHash}`).digest("hex")
    : null;

  return NextResponse.json({
    issuedAt,
    sig,
    minAgeSec: 3,
    ttlSec: 7200,
  });
}
