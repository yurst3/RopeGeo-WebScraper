-- migrate:up

-- Rename pageCount to rawPageCount (value from getRegions API)
ALTER TABLE "RopewikiRegion"
    RENAME COLUMN "pageCount" TO "rawPageCount";

-- Add computed count columns (nullable; populated by updateRegionTrueCounts after region/page data is loaded)
ALTER TABLE "RopewikiRegion"
    ADD COLUMN "truePageCount" integer,
    ADD COLUMN "trueRegionCount" integer,
    ADD COLUMN "truePageCountWithDescendents" integer;

-- migrate:down

ALTER TABLE "RopewikiRegion"
    DROP COLUMN IF EXISTS "truePageCountWithDescendents",
    DROP COLUMN IF EXISTS "trueRegionCount",
    DROP COLUMN IF EXISTS "truePageCount";

ALTER TABLE "RopewikiRegion"
    RENAME COLUMN "rawPageCount" TO "pageCount";
