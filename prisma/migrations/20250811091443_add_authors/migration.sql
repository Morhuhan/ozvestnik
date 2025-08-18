/*
  Warnings:

  - You are about to drop the `_AuthorArticles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."_AuthorArticles" DROP CONSTRAINT "_AuthorArticles_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_AuthorArticles" DROP CONSTRAINT "_AuthorArticles_B_fkey";

-- DropTable
DROP TABLE "public"."_AuthorArticles";

-- CreateTable
CREATE TABLE "public"."Author" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "patronymic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuthorOnArticle" (
    "articleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuthorOnArticle_pkey" PRIMARY KEY ("articleId","authorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Author_slug_key" ON "public"."Author"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Author_lastName_firstName_patronymic_key" ON "public"."Author"("lastName", "firstName", "patronymic");

-- CreateIndex
CREATE INDEX "AuthorOnArticle_authorId_idx" ON "public"."AuthorOnArticle"("authorId");

-- AddForeignKey
ALTER TABLE "public"."AuthorOnArticle" ADD CONSTRAINT "AuthorOnArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthorOnArticle" ADD CONSTRAINT "AuthorOnArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;
