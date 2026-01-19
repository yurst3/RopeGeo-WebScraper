-- migrate:up

-- Drop the foreign key constraint on parentRegion
ALTER TABLE "RopewikiRegion"
    DROP CONSTRAINT IF EXISTS "fk_ropewikiRegion_parentRegion";

-- Change parentRegion from uuid to text (string)
ALTER TABLE "RopewikiRegion"
    ALTER COLUMN "parentRegion" TYPE text USING "parentRegion"::text;

-- Add new columns to match RopewikiRegion class properties
ALTER TABLE "RopewikiRegion"
    ADD COLUMN "pageCount" integer NOT NULL,
    ADD COLUMN "level" integer NOT NULL,
    ADD COLUMN "overview" text,
    ADD COLUMN "bestMonths" jsonb NOT NULL,
    ADD COLUMN "isMajorRegion" boolean,
    ADD COLUMN "isTopLevelRegion" boolean,
    ADD COLUMN "url" text NOT NULL;

-- migrate:down

-- Remove the new columns
ALTER TABLE "RopewikiRegion"
    DROP COLUMN IF EXISTS "url",
    DROP COLUMN IF EXISTS "isTopLevelRegion",
    DROP COLUMN IF EXISTS "isMajorRegion",
    DROP COLUMN IF EXISTS "bestMonths",
    DROP COLUMN IF EXISTS "overview",
    DROP COLUMN IF EXISTS "level",
    DROP COLUMN IF EXISTS "pageCount";

-- Change parentRegion back from text to uuid
-- Note: This will fail if there are text values that aren't valid UUIDs
ALTER TABLE "RopewikiRegion"
    ALTER COLUMN "parentRegion" TYPE uuid USING "parentRegion"::uuid;

-- Re-add the foreign key constraint
ALTER TABLE "RopewikiRegion"
    ADD CONSTRAINT "fk_ropewikiRegion_parentRegion" 
    FOREIGN KEY ("parentRegion") REFERENCES "RopewikiRegion"("id");
