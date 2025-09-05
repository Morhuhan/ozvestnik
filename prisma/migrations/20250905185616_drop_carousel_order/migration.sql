/*
  Warnings:

  - You are about to drop the column `carouselOrder` on the `Article` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Article_inCarousel_carouselOrder_idx";

-- AlterTable
ALTER TABLE "public"."Article" DROP COLUMN "carouselOrder";

-- CreateIndex
CREATE INDEX "Article_inCarousel_idx" ON "public"."Article"("inCarousel");
