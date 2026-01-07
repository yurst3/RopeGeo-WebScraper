-- migrate:up

-- Add order column to RopewikiPageBetaSection
ALTER TABLE "RopewikiPageBetaSection"
    ADD COLUMN "order" integer NOT NULL;

-- Add order column to RopewikiImage
ALTER TABLE "RopewikiImage"
    ADD COLUMN "order" integer NOT NULL;

-- Add new unique constraint on ropewikiPage and order for RopewikiPageBetaSection
ALTER TABLE "RopewikiPageBetaSection"
    ADD CONSTRAINT "uk_ropewikiPageBetaSection_ropewikiPage_order"
    UNIQUE ("ropewikiPage", "order");

-- Add new unique constraint on ropewikiPage, betaSection, and order for RopewikiImage
ALTER TABLE "RopewikiImage"
    ADD CONSTRAINT "uk_ropewikiImage_ropewikiPage_betaSection_order"
    UNIQUE NULLS NOT DISTINCT ("ropewikiPage", "betaSection", "order");

-- migrate:down

-- Drop the new unique constraints
ALTER TABLE "RopewikiPageBetaSection"
    DROP CONSTRAINT IF EXISTS "uk_ropewikiPageBetaSection_ropewikiPage_order";

ALTER TABLE "RopewikiImage"
    DROP CONSTRAINT IF EXISTS "uk_ropewikiImage_ropewikiPage_betaSection_order";

-- Remove the order columns
ALTER TABLE "RopewikiPageBetaSection"
    DROP COLUMN IF EXISTS "order";

ALTER TABLE "RopewikiImage"
    DROP COLUMN IF EXISTS "order";

