-- migrate:up

-- 1. Rename: overallLength -> descentLength, hikeLength -> overallLength (so we have columns for LengthAndElevGain)
ALTER TABLE "RopewikiPage"
    RENAME COLUMN "overallLength" TO "descentLength";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "hikeLength" TO "overallLength";

-- 2. Add missing LengthAndElevGain columns (approachLength, descentElevGain, exitLength)
ALTER TABLE "RopewikiPage"
    ADD COLUMN "approachLength" numeric,
    ADD COLUMN "descentElevGain" numeric,
    ADD COLUMN "exitLength" numeric;

-- 3. Convert length/elevGain columns from jsonb to numeric (existing data set to null)
ALTER TABLE "RopewikiPage"
    ALTER COLUMN "overallLength" TYPE numeric USING NULL,
    ALTER COLUMN "descentLength" TYPE numeric USING NULL,
    ALTER COLUMN "approachElevGain" TYPE numeric USING NULL,
    ALTER COLUMN "exitElevGain" TYPE numeric USING NULL;

-- migrate:down

ALTER TABLE "RopewikiPage"
    ALTER COLUMN "overallLength" TYPE jsonb USING NULL,
    ALTER COLUMN "descentLength" TYPE jsonb USING NULL,
    ALTER COLUMN "approachElevGain" TYPE jsonb USING NULL,
    ALTER COLUMN "exitElevGain" TYPE jsonb USING NULL;

ALTER TABLE "RopewikiPage"
    DROP COLUMN IF EXISTS "approachLength",
    DROP COLUMN IF EXISTS "descentElevGain",
    DROP COLUMN IF EXISTS "exitLength";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "descentLength" TO "overallLength";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "overallLength" TO "hikeLength";
