-- migrate:up

-- Add new columns to RopewikiPage
ALTER TABLE "RopewikiPage"
    ADD COLUMN "rappelInfo" text,
    ADD COLUMN "aka" jsonb,
    ADD COLUMN "betaSites" jsonb,
    ADD COLUMN "userVotes" integer;

-- Change rappelCount from text to integer
ALTER TABLE "RopewikiPage"
    ALTER COLUMN "rappelCount" TYPE integer USING ("rappelCount"::integer);

-- migrate:down

-- Change rappelCount back to text
ALTER TABLE "RopewikiPage"
    ALTER COLUMN "rappelCount" TYPE text USING ("rappelCount"::text);

-- Remove new columns
ALTER TABLE "RopewikiPage"
    DROP COLUMN IF EXISTS "userVotes",
    DROP COLUMN IF EXISTS "betaSites",
    DROP COLUMN IF EXISTS "aka",
    DROP COLUMN IF EXISTS "rappelInfo";
