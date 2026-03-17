-- migrate:up

ALTER TABLE "MapData"
    ADD COLUMN "bounds" jsonb NULL;

-- migrate:down

ALTER TABLE "MapData"
    DROP COLUMN "bounds";
