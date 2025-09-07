-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "bannedById" TEXT,
ADD COLUMN     "bannedUntil" TIMESTAMP(3),
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_isBanned_idx" ON "public"."User"("isBanned");

-- CreateIndex
CREATE INDEX "User_bannedUntil_idx" ON "public"."User"("bannedUntil");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
