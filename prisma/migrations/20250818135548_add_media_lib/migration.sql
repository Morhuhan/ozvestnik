-- CreateEnum
CREATE TYPE "public"."MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MediaRole" AS ENUM ('COVER', 'BODY', 'GALLERY');

-- CreateTable
CREATE TABLE "public"."MediaAsset" (
    "id" TEXT NOT NULL,
    "kind" "public"."MediaKind" NOT NULL,
    "mime" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "ext" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" INTEGER,
    "yandexPath" TEXT NOT NULL,
    "publicUrl" TEXT,
    "publicKey" TEXT,
    "downloadHref" TEXT,
    "downloadHrefExpiresAt" TIMESTAMP(3),
    "title" TEXT,
    "alt" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ArticleMedia" (
    "articleId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "role" "public"."MediaRole" NOT NULL DEFAULT 'BODY',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArticleMedia_pkey" PRIMARY KEY ("articleId","mediaId","role")
);

-- CreateIndex
CREATE INDEX "ArticleMedia_mediaId_idx" ON "public"."ArticleMedia"("mediaId");

-- AddForeignKey
ALTER TABLE "public"."MediaAsset" ADD CONSTRAINT "MediaAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleMedia" ADD CONSTRAINT "ArticleMedia_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleMedia" ADD CONSTRAINT "ArticleMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
