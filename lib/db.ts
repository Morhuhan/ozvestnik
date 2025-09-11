// lib/db.ts
import { PrismaClient, type User, Prisma } from "@prisma/client";

type ExtendedPrisma = PrismaClient & { _auditMiddlewareInstalled?: boolean };

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma };

export const prisma: ExtendedPrisma =
  globalForPrisma.prisma ?? (new PrismaClient({ log: ["warn", "error"] }) as ExtendedPrisma);

if (!prisma._auditMiddlewareInstalled) {
  prisma.$use(async (params: Prisma.MiddlewareParams, next) => {
    if (params.model === "AuditLog") {
      return next(params);
    }

    const result = await next(params);

    if (params.model === "User" && params.action === "create") {
      try {
        const { auditLog } = await import("./audit");
        const user = result as User | null;

        await auditLog({
          action: "USER_REGISTER",
          targetType: "USER",
          targetId: user?.id ?? null,
          summary: `Регистрация пользователя: ${user?.email ?? user?.id ?? "unknown"}`,
          detail: user
            ? { userId: user.id, email: user.email ?? null }
            : { userId: null, email: null },
        });
      } catch {
      }
    }

    return result;
  });

  prisma._auditMiddlewareInstalled = true;
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
