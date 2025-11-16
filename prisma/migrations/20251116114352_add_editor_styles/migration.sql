-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "fontSize" TEXT DEFAULT '16px',
ADD COLUMN     "lineHeight" TEXT DEFAULT '1.75',
ADD COLUMN     "paragraphSpacing" TEXT DEFAULT '1.5em';
