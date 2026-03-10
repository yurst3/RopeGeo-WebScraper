-- migrate:up

ALTER TABLE "ImageData" RENAME COLUMN "preview" TO "previewUrl";
ALTER TABLE "ImageData" RENAME COLUMN "banner" TO "bannerUrl";
ALTER TABLE "ImageData" RENAME COLUMN "source" TO "sourceUrl";

-- migrate:down

ALTER TABLE "ImageData" RENAME COLUMN "previewUrl" TO "preview";
ALTER TABLE "ImageData" RENAME COLUMN "bannerUrl" TO "banner";
ALTER TABLE "ImageData" RENAME COLUMN "sourceUrl" TO "source";
