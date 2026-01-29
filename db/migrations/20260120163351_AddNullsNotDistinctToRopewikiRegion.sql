-- migrate:up

-- Drop the existing unique constraint
ALTER TABLE "RopewikiRegion"
    DROP CONSTRAINT IF EXISTS "uk_ropewikiRegion_name_parentRegion";

-- Recreate the unique constraint with NULLS NOT DISTINCT on parentRegion
ALTER TABLE "RopewikiRegion"
    ADD CONSTRAINT "uk_ropewikiRegion_name_parentRegion"
    UNIQUE NULLS NOT DISTINCT (name, "parentRegion");

-- migrate:down

-- Drop the constraint with NULLS NOT DISTINCT
ALTER TABLE "RopewikiRegion"
    DROP CONSTRAINT IF EXISTS "uk_ropewikiRegion_name_parentRegion";

-- Recreate the original constraint without NULLS NOT DISTINCT
ALTER TABLE "RopewikiRegion"
    ADD CONSTRAINT "uk_ropewikiRegion_name_parentRegion"
    UNIQUE (name, "parentRegion");
