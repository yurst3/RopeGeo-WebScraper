-- migrate:up

-- Create MapData table
CREATE TABLE "MapData" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "gpxUrl" text,
    "kmlUrl" text,
    "geoJsonUrl" text,
    "vectorTileUrl" text,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone,
    CONSTRAINT "MapData_pkey" PRIMARY KEY (id)
);

-- Rename vectorTile column to mapData in RopewikiRoute
ALTER TABLE "RopewikiRoute"
    RENAME COLUMN "vectorTile" TO "mapData";

-- Add foreign key constraint from RopewikiRoute.mapData to MapData.id
ALTER TABLE "RopewikiRoute"
    ADD CONSTRAINT "fk_ropewikiRoute_mapData"
    FOREIGN KEY ("mapData") REFERENCES "MapData"(id);

-- migrate:down

-- Drop the foreign key constraint
ALTER TABLE "RopewikiRoute"
    DROP CONSTRAINT IF EXISTS "fk_ropewikiRoute_mapData";

-- Rename mapData column back to vectorTile
ALTER TABLE "RopewikiRoute"
    RENAME COLUMN "mapData" TO "vectorTile";

-- Drop MapData table
DROP TABLE IF EXISTS "MapData";
