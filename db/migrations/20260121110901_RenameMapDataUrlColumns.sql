-- migrate:up

-- Rename MapData columns to remove "Url" suffix
ALTER TABLE "MapData"
    RENAME COLUMN "gpxUrl" TO "gpx";

ALTER TABLE "MapData"
    RENAME COLUMN "kmlUrl" TO "kml";

ALTER TABLE "MapData"
    RENAME COLUMN "geoJsonUrl" TO "geoJson";

ALTER TABLE "MapData"
    RENAME COLUMN "vectorTileUrl" TO "vectorTile";

-- migrate:down

-- Rename MapData columns back to include "Url" suffix
ALTER TABLE "MapData"
    RENAME COLUMN "gpx" TO "gpxUrl";

ALTER TABLE "MapData"
    RENAME COLUMN "kml" TO "kmlUrl";

ALTER TABLE "MapData"
    RENAME COLUMN "geoJson" TO "geoJsonUrl";

ALTER TABLE "MapData"
    RENAME COLUMN "vectorTile" TO "vectorTileUrl";
