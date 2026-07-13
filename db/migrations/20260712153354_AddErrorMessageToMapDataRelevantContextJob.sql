-- migrate:up

ALTER TABLE "MapDataRelevantContextJob"
  ADD COLUMN "errorMessage" text;

-- migrate:down

ALTER TABLE "MapDataRelevantContextJob"
  DROP COLUMN IF EXISTS "errorMessage";
