-- migrate:up

-- Replace the order unique constraint with a partial unique index so that multiple
-- rows can have order = null (soft-deleted) without violating uniqueness.
-- Uniqueness is still enforced for (ropewikiPage, betaSection, order) when order IS NOT NULL.
-- NULLS NOT DISTINCT ensures (page, null, 1) and (page, null, 1) are still considered duplicates.

ALTER TABLE "RopewikiImage"
    DROP CONSTRAINT IF EXISTS "uk_ropewikiImage_ropewikiPage_betaSection_order";

CREATE UNIQUE INDEX "uk_ropewikiImage_ropewikiPage_betaSection_order"
    ON "RopewikiImage" ("ropewikiPage", "betaSection", "order") NULLS NOT DISTINCT
    WHERE "order" IS NOT NULL;

-- migrate:down

DROP INDEX IF EXISTS "uk_ropewikiImage_ropewikiPage_betaSection_order";

ALTER TABLE "RopewikiImage"
    ADD CONSTRAINT "uk_ropewikiImage_ropewikiPage_betaSection_order"
    UNIQUE NULLS NOT DISTINCT ("ropewikiPage", "betaSection", "order");
