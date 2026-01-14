-- migrate:up

-- Add default UUID v4 generation for Route id column
ALTER TABLE "Route"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- migrate:down

-- Remove default UUID generation from Route id column
ALTER TABLE "Route"
    ALTER COLUMN "id" DROP DEFAULT;