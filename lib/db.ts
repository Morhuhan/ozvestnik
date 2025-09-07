// C:\Users\radio\Projects\ozerskiy-vestnik\lib\db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient & { _auditMiddlewareInstalled?: boolean };
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (!prisma._auditMiddlewareInstalled) {
  prisma.$use(async (params, next) => {
    if (params.model === "AuditLog") {
      return next(params);
    }

    const result = await next(params);

    if (params.model === "User" && params.action === "create") {
      try {
        const { auditLog } = await import("./audit");
        const user = result as any;
        await auditLog({
          action: "USER_REGISTER",
          targetType: "USER",
          targetId: user?.id ?? null,
          summary: `Регистрация пользователя: ${user?.email ?? user?.id ?? "unknown"}`,
          detail: { userId: user?.id, email: user?.email },
        });
      } catch {
      }
    }
    return result;
  });

  prisma._auditMiddlewareInstalled = true;
}

// Кешируем клиент в dev, чтобы не плодить соединения
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
