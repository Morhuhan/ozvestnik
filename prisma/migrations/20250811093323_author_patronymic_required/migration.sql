/*
  Warnings:

  - Made the column `patronymic` on table `Author` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Author" ALTER COLUMN "patronymic" SET NOT NULL;
