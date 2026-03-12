-- migrate:up
-- Rename fullUrl to losslessUrl, add new fullUrl column and metadata (jsonb).
-- Row data is not migrated; fullUrl will be populated later.
ALTER TABLE "ImageData" RENAME COLUMN "fullUrl" TO "losslessUrl";
ALTER TABLE "ImageData" ADD COLUMN "fullUrl" text;
ALTER TABLE "ImageData" ADD COLUMN "metadata" jsonb;

-- migrate:down
ALTER TABLE "ImageData" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "ImageData" DROP COLUMN IF EXISTS "fullUrl";
ALTER TABLE "ImageData" RENAME COLUMN "losslessUrl" TO "fullUrl";
