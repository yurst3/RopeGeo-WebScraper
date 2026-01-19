-- migrate:up

-- Add default UUID v4 generation for RopewikiRegion id column
ALTER TABLE "RopewikiRegion"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- migrate:down

-- Remove default UUID generation from RopewikiRegion id column
ALTER TABLE "RopewikiRegion"
    ALTER COLUMN "id" DROP DEFAULT;
