-- migrate:up

-- Allow "order" to be NULL when row is soft-deleted, so we can soft-delete all then upsert
-- without unique constraint conflicts. Enforce via CHECK: order may be null only when deletedAt is not null.

ALTER TABLE "RopewikiPageBetaSection"
    ALTER COLUMN "order" DROP NOT NULL;

ALTER TABLE "RopewikiPageBetaSection"
    ADD CONSTRAINT "chk_ropewikiPageBetaSection_order_null_only_when_deleted"
    CHECK ("order" IS NOT NULL OR "deletedAt" IS NOT NULL);

ALTER TABLE "RopewikiImage"
    ALTER COLUMN "order" DROP NOT NULL;

ALTER TABLE "RopewikiImage"
    ADD CONSTRAINT "chk_ropewikiImage_order_null_only_when_deleted"
    CHECK ("order" IS NOT NULL OR "deletedAt" IS NOT NULL);

-- migrate:down

ALTER TABLE "RopewikiPageBetaSection"
    DROP CONSTRAINT IF EXISTS "chk_ropewikiPageBetaSection_order_null_only_when_deleted";

ALTER TABLE "RopewikiImage"
    DROP CONSTRAINT IF EXISTS "chk_ropewikiImage_order_null_only_when_deleted";

-- Restore NOT NULL: set order to 0 for any rows where order is null (soft-deleted rows)
UPDATE "RopewikiPageBetaSection" SET "order" = 0 WHERE "order" IS NULL;
UPDATE "RopewikiImage" SET "order" = 0 WHERE "order" IS NULL;

ALTER TABLE "RopewikiPageBetaSection"
    ALTER COLUMN "order" SET NOT NULL;

ALTER TABLE "RopewikiImage"
    ALTER COLUMN "order" SET NOT NULL;
