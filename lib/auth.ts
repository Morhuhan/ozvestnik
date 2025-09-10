import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./db";

// Проверяем токен VK на сервере: дергаем users.get и сверяем id
async function verifyVkToken(accessToken: string) {
  const url = new URL("https://api.vk.com/method/users.get");
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("v", "5.131");
  url.searchParams.set("fields", "photo_100,first_name,last_name");

  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const data = await res.json().catch(() => ({} as any));

  if (data?.error) {
    throw new Error(`VK API error: ${data.error?.error_msg || "unknown"}`);
  }

  const user = data?.response?.[0];
  if (!user?.id) throw new Error("VK API: empty user");

  return {
    id: String(user.id),
    name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || `VK пользователь ${user.id}`,
    image: user.photo_100 || null,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  providers: [
    // Локальный логин по email/паролю
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

    // VK ID через SDK: на вход уже прилетает accessToken + userId
    Credentials({
      id: "vkid",
      name: "VK ID",
      credentials: {
        accessToken: { label: "accessToken", type: "text" },
        userId: { label: "userId", type: "text" },
      },
      async authorize(creds) {
        const accessToken = creds?.accessToken?.toString() || "";
        const userId = creds?.userId?.toString() || "";
        if (!accessToken || !userId) return null;

        // Верифицируем токен запросом к VK API
        const vk = await verifyVkToken(accessToken);
        if (vk.id !== userId) {
          throw new Error("VK token/user mismatch");
        }

        const provider = "vkid";
        const providerAccountId = vk.id;

        // Ищем привязку аккаунта
        const existing = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider, providerAccountId } },
          include: { user: true },
        });

        const nowExp = Math.floor(Date.now() / 1000) + 3600; // VK токен обычно короткий

        if (existing?.user) {
          await prisma.account.update({
            where: { id: existing.id },
            data: {
              access_token: accessToken,
              expires_at: nowExp,
            },
          });
          return {
            id: existing.user.id,
            email: existing.user.email ?? null,
            role: existing.user.role,
          } as any;
        }

        // Создаём пользователя
        const user = await prisma.user.create({
          data: {
            name: vk.name,
            image: vk.image,
            role: "READER",
          },
          select: { id: true, email: true, role: true },
        });

        // Привязываем аккаунт
        await prisma.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider,
            providerAccountId,
            access_token: accessToken,
            expires_at: nowExp,
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
