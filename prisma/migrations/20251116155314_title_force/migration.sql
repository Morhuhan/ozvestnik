UPDATE "MediaAsset"
SET "title" = "filename"
WHERE "title" IS NULL;

ALTER TABLE "MediaAsset" ALTER COLUMN "title" SET NOT NULL;
