-- migrate:up

ALTER TABLE "MapDataRelevantContextJob"
  ADD COLUMN "errors" jsonb;

UPDATE "MapDataRelevantContextJob"
SET "errors" = jsonb_build_array(jsonb_build_object('message', "errorMessage"))
WHERE "errorMessage" IS NOT NULL;

ALTER TABLE "MapDataRelevantContextJob"
  DROP COLUMN "errorMessage";

-- migrate:down

ALTER TABLE "MapDataRelevantContextJob"
  ADD COLUMN "errorMessage" text;

UPDATE "MapDataRelevantContextJob"
SET "errorMessage" = "errors" -> 0 ->> 'message'
WHERE "errors" IS NOT NULL
  AND jsonb_typeof("errors") = 'array'
  AND jsonb_array_length("errors") > 0;

ALTER TABLE "MapDataRelevantContextJob"
  DROP COLUMN "errors";
