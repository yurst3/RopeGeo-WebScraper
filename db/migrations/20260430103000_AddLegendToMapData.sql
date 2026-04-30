-- migrate:up

ALTER TABLE "MapData" ADD COLUMN "legend" jsonb NULL;

-- migrate:down

ALTER TABLE "MapData" DROP COLUMN IF EXISTS "legend";
