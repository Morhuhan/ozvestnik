import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./db";

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
        accessToken: { label: "accessToken", type: "text" },
        userId: { label: "userId", type: "text" },
        name: { label: "name", type: "text" },
        email: { label: "email", type: "text" },
        image: { label: "image", type: "text" },
      },
      async authorize(creds) {
        const { accessToken, userId, name, email, image } = creds || {};

        if (!accessToken || !userId || !name) {
          console.error("[VKID Authorize] Missing credentials");
          return null;
        }

        const provider = "vkid";
        const providerAccountId = userId;
        const nowExp = Math.floor(Date.now() / 1000) + 3600;

        // Ищем существующий аккаунт VK ID
        const existingAccount = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider, providerAccountId } },
          include: { user: true },
        });

        if (existingAccount?.user) {
          // Обновляем данные пользователя и токен
          await prisma.user.update({
            where: { id: existingAccount.user.id },
            data: {
              name: name,
              image: image,
            },
          });

          await prisma.account.update({
            where: { id: existingAccount.id },
            data: {
              access_token: accessToken,
              expires_at: nowExp,
            },
          });
          
          return {
            id: existingAccount.user.id,
            email: existingAccount.user.email,
            name: existingAccount.user.name,
            image: existingAccount.user.image,
            role: existingAccount.user.role,
          } as any;
        }

        // Ищем пользователя по email, чтобы привязать аккаунт VK
        let user = null;
        if (email) {
          user = await prisma.user.findUnique({
            where: { email: email },
          });
        }

        if (user) {
          // Привязываем VK ID к существующему пользователю
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
        } else {
          // Создаем нового пользователя
          user = await prisma.user.create({
            data: {
              name: name,
              email: email,
              image: image,
              role: "READER",
            },
          });

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
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        } as any;
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.name = (user as any).name;
        token.image = (user as any).image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub || (token as any).id;
        (session.user as any).role = (token as any).role;
        (session.user as any).name = (token as any).name;
        (session.user as any).image = (token as any).image;
      }
      return session;
    },
  },
};