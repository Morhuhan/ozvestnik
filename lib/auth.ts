import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./db";
import { vkidExchangeCode, VKIDTokenResult } from "./vkid";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: { id: true, email: true, role: true, passwordHash: true },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, role: user.role } as any;
      },
    }),

    Credentials({
      id: "vkid",
      name: "VK ID",
      credentials: {
        code: { label: "Code", type: "text" },
        deviceId: { label: "Device ID", type: "text" },
        codeVerifier: { label: "Code Verifier", type: "text" },
      },
      async authorize(creds) {
        const code = creds?.code?.toString() || "";
        const deviceId = creds?.deviceId?.toString() || "";
        const codeVerifier = creds?.codeVerifier?.toString() || "";

        if (!code || !deviceId || !codeVerifier) {
          console.error("VKID Authorize: Missing credentials");
          return null;
        }

        let tokens: VKIDTokenResult;
        try {
          tokens = await vkidExchangeCode({ code, deviceId, codeVerifier });
        } catch (error) {
          console.error("VKID token exchange failed:", error);
          return null;
        }

        const vkUserId = String(tokens.user_id);
        const provider = "vkid";
        const providerAccountId = vkUserId;

        const existing = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider, providerAccountId } },
          include: { user: true },
        });

        const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

        if (existing?.user) {
          await prisma.account.update({
            where: { id: existing.id },
            data: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: expiresAt,
            },
          });
          return {
            id: existing.user.id,
            email: existing.user.email ?? null,
            role: existing.user.role,
          } as any;
        }

        let vkUser: any;
        try {
            const userData = await fetch(`https://api.vk.com/method/users.get?user_ids=${vkUserId}&fields=photo_100,first_name,last_name&access_token=${tokens.access_token}&v=5.131`, { cache: "no-store" });
            const data = await userData.json();
            vkUser = data.response?.[0];
        } catch (e) {
            console.error("Failed to fetch user data from VK API", e);
        }

        const user = await prisma.user.create({
          data: {
            name: [vkUser?.first_name, vkUser?.last_name].filter(Boolean).join(" ").trim() || `VK пользователь ${vkUserId}`,
            image: vkUser?.photo_100 || null,
            role: "READER",
          },
          select: { id: true, email: true, role: true },
        });

        await prisma.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider,
            providerAccountId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt,
          },
        });

        return { id: user.id, email: user.email ?? null, role: user.role } as any;
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub || (token as any).id;
        (session.user as any).role = (token as any).role;
      }
      return session;
    },
  },
};