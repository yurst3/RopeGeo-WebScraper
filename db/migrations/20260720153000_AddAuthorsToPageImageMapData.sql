-- migrate:up

ALTER TABLE "RopewikiPage"
    ADD COLUMN "authors" text[];

ALTER TABLE "RopewikiImage"
    ADD COLUMN "authors" text[];

ALTER TABLE "MapData"
    ADD COLUMN "authors" text[];

-- migrate:down

ALTER TABLE "MapData"
    DROP COLUMN IF EXISTS "authors";

ALTER TABLE "RopewikiImage"
    DROP COLUMN IF EXISTS "authors";

ALTER TABLE "RopewikiPage"
    DROP COLUMN IF EXISTS "authors";
