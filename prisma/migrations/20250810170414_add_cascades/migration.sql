-- DropForeignKey
ALTER TABLE "public"."TagOnArticle" DROP CONSTRAINT "TagOnArticle_articleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TagOnArticle" DROP CONSTRAINT "TagOnArticle_tagId_fkey";

-- AddForeignKey
ALTER TABLE "public"."TagOnArticle" ADD CONSTRAINT "TagOnArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagOnArticle" ADD CONSTRAINT "TagOnArticle_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
