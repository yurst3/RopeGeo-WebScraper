-- migrate:up

ALTER TABLE "MapData"
    RENAME COLUMN "tiles" TO "tilesTemplate";

UPDATE "MapData"
SET "tilesTemplate" = rtrim("tilesTemplate", '/') || '/{z}/{x}/{y}.pbf'
WHERE "tilesTemplate" IS NOT NULL
  AND "tilesTemplate" !~ $$/\{z\}/\{x\}/\{y\}\.pbf$$;

-- migrate:down

UPDATE "MapData"
SET "tilesTemplate" = regexp_replace("tilesTemplate", $$/\{z\}/\{x\}/\{y\}\.pbf$$, '')
WHERE "tilesTemplate" IS NOT NULL
  AND "tilesTemplate" ~ $$/\{z\}/\{x\}/\{y\}\.pbf$$;

ALTER TABLE "MapData"
    RENAME COLUMN "tilesTemplate" TO "tiles";
