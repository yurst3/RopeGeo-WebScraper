-- migrate:up

ALTER TABLE "MapData"
    RENAME COLUMN "vectorTile" TO "tiles";

-- migrate:down

ALTER TABLE "MapData"
    RENAME COLUMN "tiles" TO "vectorTile";
