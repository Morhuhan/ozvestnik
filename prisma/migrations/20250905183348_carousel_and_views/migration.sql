-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "carouselFrom" TIMESTAMP(3),
ADD COLUMN     "carouselOrder" INTEGER,
ADD COLUMN     "carouselTo" TIMESTAMP(3),
ADD COLUMN     "inCarousel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "uniqueDailyViews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "viewsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."ArticleView" (
    "articleId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "viewDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleView_pkey" PRIMARY KEY ("articleId","sessionHash","viewDate")
);

-- CreateIndex
CREATE INDEX "ArticleView_articleId_viewDate_idx" ON "public"."ArticleView"("articleId", "viewDate");

-- CreateIndex
CREATE INDEX "Article_inCarousel_carouselOrder_idx" ON "public"."Article"("inCarousel", "carouselOrder");

-- CreateIndex
CREATE INDEX "Article_carouselFrom_idx" ON "public"."Article"("carouselFrom");

-- CreateIndex
CREATE INDEX "Article_carouselTo_idx" ON "public"."Article"("carouselTo");

-- AddForeignKey
ALTER TABLE "public"."ArticleView" ADD CONSTRAINT "ArticleView_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
