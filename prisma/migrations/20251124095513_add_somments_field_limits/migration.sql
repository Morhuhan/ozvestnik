/*
  Warnings:

  - You are about to alter the column `guestName` on the `Comment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - You are about to alter the column `guestEmail` on the `Comment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `body` on the `Comment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(2000)`.

*/
-- AlterTable
ALTER TABLE "public"."Comment" ALTER COLUMN "guestName" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "guestEmail" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "body" SET DATA TYPE VARCHAR(2000);
