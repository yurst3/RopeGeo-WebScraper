-- migrate:up
-- Convert ImageData preview/banner/full URLs from S3 bucket URLs to the API domain
-- (https://api.webscraper.ropegeo.com/images/<id>/<file>.avif) so traffic goes through CloudFront.
UPDATE "ImageData"
SET "previewUrl" = 'https://api.webscraper.ropegeo.com/images/' || id || '/preview.avif'
WHERE "previewUrl" IS NOT NULL AND "previewUrl" LIKE '%s3%amazonaws.com%';

UPDATE "ImageData"
SET "bannerUrl" = 'https://api.webscraper.ropegeo.com/images/' || id || '/banner.avif'
WHERE "bannerUrl" IS NOT NULL AND "bannerUrl" LIKE '%s3%amazonaws.com%';

UPDATE "ImageData"
SET "fullUrl" = 'https://api.webscraper.ropegeo.com/images/' || id || '/full.avif'
WHERE "fullUrl" IS NOT NULL AND "fullUrl" LIKE '%s3%amazonaws.com%';

-- migrate:down
-- Cannot restore original S3 URLs; no-op. Re-run ImageProcessor for affected rows to repopulate if needed.
