-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "commentsGuestsAllowed" BOOLEAN NOT NULL DEFAULT true;
