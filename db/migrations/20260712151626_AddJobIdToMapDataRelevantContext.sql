-- migrate:up

ALTER TABLE "MapDataRelevantContext"
  ADD COLUMN "jobId" uuid;

ALTER TABLE "MapDataRelevantContext"
  ADD CONSTRAINT "fk_mapDataRelevantContext_job"
  FOREIGN KEY ("jobId") REFERENCES "MapDataRelevantContextJob"("id") ON DELETE SET NULL;

CREATE INDEX "idx_mapDataRelevantContext_mapDataId_jobId"
  ON "MapDataRelevantContext" ("mapDataId", "jobId");

-- migrate:down

DROP INDEX IF EXISTS "idx_mapDataRelevantContext_mapDataId_jobId";

ALTER TABLE "MapDataRelevantContext"
  DROP CONSTRAINT IF EXISTS "fk_mapDataRelevantContext_job";

ALTER TABLE "MapDataRelevantContext"
  DROP COLUMN IF EXISTS "jobId";
