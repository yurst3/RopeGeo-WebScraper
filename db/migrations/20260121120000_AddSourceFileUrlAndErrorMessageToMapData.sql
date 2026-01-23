-- migrate:up

-- Add sourceFileUrl column (NOT NULL)
ALTER TABLE "MapData"
    ADD COLUMN "sourceFileUrl" text NOT NULL DEFAULT '';

-- Add errorMessage column (nullable)
ALTER TABLE "MapData"
    ADD COLUMN "errorMessage" text;

-- migrate:down

-- Remove the columns
ALTER TABLE "MapData"
    DROP COLUMN IF EXISTS "errorMessage";

ALTER TABLE "MapData"
    DROP COLUMN IF EXISTS "sourceFileUrl";
