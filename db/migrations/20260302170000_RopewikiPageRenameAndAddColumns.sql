-- migrate:up

-- Rename columns
ALTER TABLE "RopewikiPage"
    RENAME COLUMN "shuttle" TO "shuttleTime";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "hike" TO "hikeLength";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "minTime" TO "minOverallTime";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "maxTime" TO "maxOverallTime";

-- Add new columns (Quantity type in API → jsonb)
ALTER TABLE "RopewikiPage"
    ADD COLUMN "overallLength" jsonb,
    ADD COLUMN "minApproachTime" jsonb,
    ADD COLUMN "maxApproachTime" jsonb,
    ADD COLUMN "minDescentTime" jsonb,
    ADD COLUMN "maxDescentTime" jsonb,
    ADD COLUMN "minExitTime" jsonb,
    ADD COLUMN "maxExitTime" jsonb,
    ADD COLUMN "approachElevGain" jsonb,
    ADD COLUMN "exitElevGain" jsonb;

-- migrate:down

ALTER TABLE "RopewikiPage"
    DROP COLUMN IF EXISTS "exitElevGain",
    DROP COLUMN IF EXISTS "approachElevGain",
    DROP COLUMN IF EXISTS "maxExitTime",
    DROP COLUMN IF EXISTS "minExitTime",
    DROP COLUMN IF EXISTS "maxDescentTime",
    DROP COLUMN IF EXISTS "minDescentTime",
    DROP COLUMN IF EXISTS "maxApproachTime",
    DROP COLUMN IF EXISTS "minApproachTime",
    DROP COLUMN IF EXISTS "overallLength";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "shuttleTime" TO "shuttle";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "hikeLength" TO "hike";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "minOverallTime" TO "minTime";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "maxOverallTime" TO "maxTime";
