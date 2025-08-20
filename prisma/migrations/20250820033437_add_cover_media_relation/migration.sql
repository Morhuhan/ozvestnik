/*
  Warnings:

  - You are about to drop the column `coverUrl` on the `Article` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Article" DROP COLUMN "coverUrl",
ADD COLUMN     "coverMediaId" TEXT;

-- CreateIndex
CREATE INDEX "Article_coverMediaId_idx" ON "public"."Article"("coverMediaId");

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "public"."MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
