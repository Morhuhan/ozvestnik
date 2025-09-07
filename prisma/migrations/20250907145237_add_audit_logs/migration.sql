-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('COMMENT_CREATE', 'COMMENT_DELETE', 'USER_BAN', 'USER_UNBAN', 'GUEST_BAN', 'USER_REGISTER');

-- CreateEnum
CREATE TYPE "public"."AuditTarget" AS ENUM ('ARTICLE', 'COMMENT', 'USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "public"."AuditAction" NOT NULL,
    "targetType" "public"."AuditTarget" NOT NULL,
    "targetId" TEXT,
    "actorId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "summary" VARCHAR(400) NOT NULL,
    "detail" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_ts_idx" ON "public"."AuditLog"("ts");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "public"."AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "public"."AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "public"."AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
