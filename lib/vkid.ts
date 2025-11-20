import { z } from "zod";

const Env = z.object({
  AUTH_VK_ID: z.string().min(1, "AUTH_VK_ID is required"),
  AUTH_VK_SECRET: z.string().min(1, "AUTH_VK_SECRET is required"),
});

const env = Env.parse({
  AUTH_VK_ID: process.env.AUTH_VK_ID,
  AUTH_VK_SECRET: process.env.AUTH_VK_SECRET,
});

export type VKIDTokenResult = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  user_id: number;
  scope?: string;
};

const VK_TOKEN_URL = "https://id.vk.com/oauth2/token";
const REDIRECT_URI = process.env.AUTH_VK_REDIRECT_URI
  ?? process.env.NEXTAUTH_URL
  ?? "https://xn----dtbhcghdehg5ad2aogq.xn--p1ai";

export async function vkidExchangeCode(params: {
  code: string;
  deviceId: string;
  codeVerifier: string;
}): Promise<VKIDTokenResult> {
  const code = params.code?.toString();
  const deviceId = params.deviceId?.toString();
  const codeVerifier = params.codeVerifier?.toString();

  if (!code) throw new Error("vkidExchangeCode: `code` is required");
  if (!deviceId) throw new Error("vkidExchangeCode: `deviceId` is required");
  if (!codeVerifier) throw new Error("vkidExchangeCode: `codeVerifier` is required");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    device_id: deviceId,
    client_id: env.AUTH_VK_ID,
    client_secret: env.AUTH_VK_SECRET,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const res = await fetch(VK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    let err: any;
    try { err = text ? JSON.parse(text) : undefined; } catch {}
    const msg = err?.error_description || err?.error || `${res.status} ${res.statusText}`;
    throw new Error(`VKID token exchange failed: ${msg}`);
  }

  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error("VKID token exchange: invalid JSON"); }

  return z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().optional(),
    expires_in: z.number().int().positive(),
    token_type: z.string().optional(),
    user_id: z.number().int(),
    scope: z.string().optional(),
  }).parse(data);
}