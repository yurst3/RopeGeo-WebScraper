-- migrate:up

CREATE TABLE "MapDataRelevantContext" (
    "mapDataId" uuid NOT NULL,
    "legendItemId" text NOT NULL,
    "measurements" jsonb,
    "betaSectionExcerpts" jsonb,
    "images" jsonb,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone,
    "allowUpdates" boolean DEFAULT true NOT NULL,
    CONSTRAINT "MapDataRelevantContext_pkey" PRIMARY KEY ("mapDataId", "legendItemId")
);

CREATE TABLE "MapDataRelevantContextJob" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "mapDataId" uuid,
    "pageId" uuid NOT NULL,
    "pageSource" text NOT NULL,
    "pageReady" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone,
    "allowUpdates" boolean DEFAULT true NOT NULL,
    CONSTRAINT "MapDataRelevantContextJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MapDataRelevantContextJob_pageId_key" UNIQUE ("pageId")
);

ALTER TABLE "MapDataRelevantContext"
    ADD CONSTRAINT "fk_mapDataRelevantContext_mapData"
    FOREIGN KEY ("mapDataId") REFERENCES "MapData"("id") ON DELETE CASCADE;

ALTER TABLE "MapDataRelevantContextJob"
    ADD CONSTRAINT "fk_mapDataRelevantContextJob_mapData"
    FOREIGN KEY ("mapDataId") REFERENCES "MapData"("id") ON DELETE SET NULL;

CREATE INDEX "idx_mapDataRelevantContext_mapDataId"
    ON "MapDataRelevantContext" ("mapDataId");

CREATE INDEX "idx_mapDataRelevantContextJob_mapDataId"
    ON "MapDataRelevantContextJob" ("mapDataId");

-- migrate:down

DROP TABLE IF EXISTS "MapDataRelevantContextJob";
DROP TABLE IF EXISTS "MapDataRelevantContext";
