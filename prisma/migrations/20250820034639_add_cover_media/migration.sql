-- DropIndex
DROP INDEX "public"."Article_coverMediaId_idx";

-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "coverUrl" TEXT;
