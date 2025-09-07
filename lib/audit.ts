// src/lib/audit.ts
import { prisma } from "./db";

type LogOpts = {
  action:
    | "COMMENT_CREATE"
    | "COMMENT_DELETE"
    | "USER_BAN"
    | "USER_UNBAN"
    | "GUEST_BAN"
    | "USER_REGISTER";
  targetType: "ARTICLE" | "COMMENT" | "USER" | "SYSTEM";
  targetId?: string | null;

  summary: string;
  detail?: any;

  actorId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
};

export async function auditLog({
  action,
  targetType,
  targetId,
  summary,
  detail,
  actorId,
  ipHash,
  userAgent,
}: LogOpts) {
  try {
    await prisma.auditLog.create({
      data: {
        action: action as any,
        targetType: targetType as any,
        targetId: targetId ?? null,
        summary: summary.slice(0, 400),
        detail: detail ?? {},
        actorId: actorId ?? null,
        ipHash: ipHash ?? null,
        userAgent: userAgent ?? null,
      },
    });
  } catch {
  }
}
