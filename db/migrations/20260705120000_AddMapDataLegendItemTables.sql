-- migrate:up

CREATE TABLE "MapDataMarkerLegendItem" (
    "id" text NOT NULL,
    "mapData" uuid NOT NULL,
    "name" text NOT NULL,
    "coordinates" jsonb NOT NULL,
    "icon" text,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MapDataMarkerLegendItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MapDataSegmentLegendItem" (
    "id" text NOT NULL,
    "mapData" uuid NOT NULL,
    "name" text NOT NULL,
    "bounds" jsonb NOT NULL,
    "strokeColor" text,
    "strokeWidth" text,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MapDataSegmentLegendItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MapDataPolygonLegendItem" (
    "id" text NOT NULL,
    "mapData" uuid NOT NULL,
    "name" text NOT NULL,
    "bounds" jsonb NOT NULL,
    "borderColor" text,
    "fillColor" text,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MapDataPolygonLegendItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MapDataMarkerLegendItem"
    ADD CONSTRAINT "fk_mapDataMarkerLegendItem_mapData"
    FOREIGN KEY ("mapData") REFERENCES "MapData"("id") ON DELETE CASCADE;

ALTER TABLE "MapDataSegmentLegendItem"
    ADD CONSTRAINT "fk_mapDataSegmentLegendItem_mapData"
    FOREIGN KEY ("mapData") REFERENCES "MapData"("id") ON DELETE CASCADE;

ALTER TABLE "MapDataPolygonLegendItem"
    ADD CONSTRAINT "fk_mapDataPolygonLegendItem_mapData"
    FOREIGN KEY ("mapData") REFERENCES "MapData"("id") ON DELETE CASCADE;

CREATE INDEX "idx_mapDataMarkerLegendItem_mapData"
    ON "MapDataMarkerLegendItem" ("mapData");

CREATE INDEX "idx_mapDataSegmentLegendItem_mapData"
    ON "MapDataSegmentLegendItem" ("mapData");

CREATE INDEX "idx_mapDataPolygonLegendItem_mapData"
    ON "MapDataPolygonLegendItem" ("mapData");

INSERT INTO "MapDataMarkerLegendItem" ("id", "mapData", "name", "coordinates", "icon")
SELECT
    entry.value->>'id',
    m.id,
    entry.value->>'name',
    entry.value->'coordinates',
    entry.value->>'icon'
FROM "MapData" m
CROSS JOIN LATERAL jsonb_each(m.legend) AS entry(key, value)
WHERE m.legend IS NOT NULL
  AND jsonb_typeof(m.legend) = 'object'
  AND entry.value->>'featureType' = 'point'
  AND entry.value->>'id' IS NOT NULL
  AND entry.value->>'id' <> ''
  AND entry.value->'coordinates' IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MapDataSegmentLegendItem" ("id", "mapData", "name", "bounds", "strokeColor", "strokeWidth")
SELECT
    entry.value->>'id',
    m.id,
    entry.value->>'name',
    entry.value->'bounds',
    entry.value->>'strokeColor',
    entry.value->>'strokeWidth'
FROM "MapData" m
CROSS JOIN LATERAL jsonb_each(m.legend) AS entry(key, value)
WHERE m.legend IS NOT NULL
  AND jsonb_typeof(m.legend) = 'object'
  AND entry.value->>'featureType' = 'line'
  AND entry.value->>'id' IS NOT NULL
  AND entry.value->>'id' <> ''
  AND entry.value->'bounds' IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MapDataPolygonLegendItem" ("id", "mapData", "name", "bounds", "borderColor", "fillColor")
SELECT
    entry.value->>'id',
    m.id,
    entry.value->>'name',
    entry.value->'bounds',
    entry.value->>'borderColor',
    entry.value->>'fillColor'
FROM "MapData" m
CROSS JOIN LATERAL jsonb_each(m.legend) AS entry(key, value)
WHERE m.legend IS NOT NULL
  AND jsonb_typeof(m.legend) = 'object'
  AND entry.value->>'featureType' = 'polygon'
  AND entry.value->>'id' IS NOT NULL
  AND entry.value->>'id' <> ''
  AND entry.value->'bounds' IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "MapData" DROP COLUMN "legend";

-- migrate:down

ALTER TABLE "MapData" ADD COLUMN "legend" jsonb;

UPDATE "MapData" m
SET "legend" = sub.agg
FROM (
    SELECT
        combined."mapData",
        jsonb_object_agg(
            combined."id",
            jsonb_strip_nulls(
                jsonb_build_object(
                    'featureType', combined."featureType",
                    'id', combined."id",
                    'name', combined."name",
                    'coordinates', combined."coordinates",
                    'bounds', combined."bounds",
                    'icon', combined."icon",
                    'strokeColor', combined."strokeColor",
                    'strokeWidth', combined."strokeWidth",
                    'borderColor', combined."borderColor",
                    'fillColor', combined."fillColor"
                )
            )
        ) AS agg
    FROM (
        SELECT
            "mapData",
            "id",
            'point'::text AS "featureType",
            "name",
            "coordinates",
            NULL::jsonb AS "bounds",
            "icon",
            NULL::text AS "strokeColor",
            NULL::text AS "strokeWidth",
            NULL::text AS "borderColor",
            NULL::text AS "fillColor"
        FROM "MapDataMarkerLegendItem"
        UNION ALL
        SELECT
            "mapData",
            "id",
            'line'::text,
            "name",
            NULL::jsonb,
            "bounds",
            NULL::text,
            "strokeColor",
            "strokeWidth",
            NULL::text,
            NULL::text
        FROM "MapDataSegmentLegendItem"
        UNION ALL
        SELECT
            "mapData",
            "id",
            'polygon'::text,
            "name",
            NULL::jsonb,
            "bounds",
            NULL::text,
            NULL::text,
            "borderColor",
            "fillColor"
        FROM "MapDataPolygonLegendItem"
    ) combined
    GROUP BY combined."mapData"
) sub
WHERE sub."mapData" = m.id;

ALTER TABLE "MapDataMarkerLegendItem" DROP CONSTRAINT IF EXISTS "fk_mapDataMarkerLegendItem_mapData";
ALTER TABLE "MapDataSegmentLegendItem" DROP CONSTRAINT IF EXISTS "fk_mapDataSegmentLegendItem_mapData";
ALTER TABLE "MapDataPolygonLegendItem" DROP CONSTRAINT IF EXISTS "fk_mapDataPolygonLegendItem_mapData";

DROP INDEX IF EXISTS "idx_mapDataMarkerLegendItem_mapData";
DROP INDEX IF EXISTS "idx_mapDataSegmentLegendItem_mapData";
DROP INDEX IF EXISTS "idx_mapDataPolygonLegendItem_mapData";

DROP TABLE IF EXISTS "MapDataMarkerLegendItem";
DROP TABLE IF EXISTS "MapDataSegmentLegendItem";
DROP TABLE IF EXISTS "MapDataPolygonLegendItem";
