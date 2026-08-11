-- migrate:up

CREATE TABLE "PageZipperJob" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "pageId" uuid NOT NULL,
    "pageSource" text NOT NULL,
    "pageReady" boolean DEFAULT false NOT NULL,
    "mapDataId" uuid,
    "pageHasMapData" boolean DEFAULT true NOT NULL,
    "mapDataLegendItemsReady" jsonb,
    "imageDataReady" jsonb,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "PageZipperJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PageZipperJob_pageId_key" UNIQUE ("pageId")
);

ALTER TABLE "PageZipperJob"
    ADD CONSTRAINT "fk_pageZipperJob_mapData"
    FOREIGN KEY ("mapDataId") REFERENCES "MapData"("id") ON DELETE SET NULL;

CREATE INDEX "idx_pageZipperJob_mapDataId"
    ON "PageZipperJob" ("mapDataId");

-- migrate:down

DROP TABLE IF EXISTS "PageZipperJob";
