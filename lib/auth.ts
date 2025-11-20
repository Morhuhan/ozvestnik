import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./db";

async function verifyVkToken(accessToken: string) {
  const url = new URL("https://api.vk.com/method/users.get");
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("v", "5.131");
  url.searchParams.set("fields", "photo_100,first_name,last_name,email");

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
    email: user.email || null,
  };
}

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
      },
      async authorize(creds) {
        const accessToken = creds?.accessToken?.toString() || "";
        const userId = creds?.userId?.toString() || "";
        if (!accessToken || !userId) return null;

        try {
          const vkUser = await verifyVkToken(accessToken);
          if (vkUser.id !== userId) {
            throw new Error("VK token/user mismatch");
          }
        } catch (e) {
          console.error("VK token verification failed:", e);
          return null;
        }

        const provider = "vkid";
        const providerAccountId = userId;
        const nowExp = Math.floor(Date.now() / 1000) + 3600;

        const existingAccount = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider, providerAccountId } },
          include: { user: true },
        });

        if (existingAccount?.user) {
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

        const vkUserData = await verifyVkToken(accessToken);
        
        let user = null;
        if (vkUserData.email) {
          user = await prisma.user.findUnique({
            where: { email: vkUserData.email },
          });
        }

        if (user) {
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
          user = await prisma.user.create({
            data: {
              name: vkUserData.name,
              email: vkUserData.email,
              image: vkUserData.image,
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