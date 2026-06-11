-- migrate:up

ALTER TABLE "MapData"
  ADD COLUMN "tileCount" integer NOT NULL DEFAULT 0,
  ADD COLUMN "tileTotalBytes" bigint NOT NULL DEFAULT 0;

-- migrate:down

ALTER TABLE "MapData" DROP COLUMN IF EXISTS "tileTotalBytes";
ALTER TABLE "MapData" DROP COLUMN IF EXISTS "tileCount";
