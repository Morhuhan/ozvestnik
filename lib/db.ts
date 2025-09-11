// lib/db.ts
import { PrismaClient } from "@prisma/client";

function makeClient() {
  const base = new PrismaClient({ log: ["warn", "error"] });

  const extended = base.$extends({
    query: {
      user: {
        async create({ args, query }) {
          const result = await query(args);

          try {
            const { auditLog } = await import("./audit");
            const user = result as { id?: string; email?: string } | null;
            await auditLog({
              action: "USER_REGISTER",
              targetType: "USER",
              targetId: user?.id ?? null,
              summary: `Регистрация пользователя: ${user?.email ?? user?.id ?? "unknown"}`,
              detail: { userId: user?.id, email: user?.email },
            });
          } catch {
          }

          return result;
        },
      },
    },
  });

  return extended;
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof makeClient> };

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
