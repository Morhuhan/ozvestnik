// src/app/api/auth/callback/vk/route.ts
export async function GET(req: Request) {
  const site = process.env.NEXTAUTH_URL || "https://localhost";
  const target = new URL("/auth/signin/vkid/callback", site);
  const incoming = new URL(req.url);
  incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  return Response.redirect(target.toString(), 302);
}
