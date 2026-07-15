-- migrate:up

CREATE TABLE "MapDataRelevantContextError" (
    "jobId" uuid NOT NULL,
    "legendItemId" text NOT NULL,
    "input" text NOT NULL,
    "errorMessage" text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MapDataRelevantContextError_pkey" PRIMARY KEY ("jobId", "legendItemId")
);

ALTER TABLE "MapDataRelevantContextError"
    ADD CONSTRAINT "fk_mapDataRelevantContextError_job"
    FOREIGN KEY ("jobId") REFERENCES "MapDataRelevantContextJob"("id") ON DELETE CASCADE;

CREATE INDEX "idx_mapDataRelevantContextError_jobId"
    ON "MapDataRelevantContextError" ("jobId");

ALTER TABLE "MapDataRelevantContextJob"
    DROP COLUMN IF EXISTS "errors";

-- migrate:down

ALTER TABLE "MapDataRelevantContextJob"
    ADD COLUMN "errors" jsonb;

DROP INDEX IF EXISTS "idx_mapDataRelevantContextError_jobId";

ALTER TABLE "MapDataRelevantContextError"
    DROP CONSTRAINT IF EXISTS "fk_mapDataRelevantContextError_job";

DROP TABLE IF EXISTS "MapDataRelevantContextError";
