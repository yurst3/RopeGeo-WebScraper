-- migrate:up

-- Normalize aka names into a separate table for index-backed search (includeAka).
-- Each row is one "also known as" name for a RopewikiPage.
CREATE TABLE "RopewikiAkaName" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "ropewikiPage" uuid NOT NULL,
    "name" text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone
);

ALTER TABLE "RopewikiAkaName"
    ADD CONSTRAINT "fk_ropewikiAkaName_ropewikiPage"
    FOREIGN KEY ("ropewikiPage") REFERENCES "RopewikiPage"("id") ON DELETE CASCADE;

ALTER TABLE "RopewikiAkaName"
    ADD CONSTRAINT "uk_ropewikiAkaName_ropewikiPage_name"
    UNIQUE ("ropewikiPage", "name");

-- Migrate existing aka data from RopewikiPage (jsonb array of strings)
INSERT INTO "RopewikiAkaName" ("ropewikiPage", "name")
SELECT p.id, elem
FROM "RopewikiPage" p,
     jsonb_array_elements_text(p.aka) AS elem
WHERE p.aka IS NOT NULL
  AND jsonb_array_length(p.aka) > 0
ON CONFLICT ("ropewikiPage", "name") DO NOTHING;

ALTER TABLE "RopewikiPage"
    DROP COLUMN "aka";

-- GIN trigram index for fuzzy search on aka names (includeAka)
CREATE INDEX IF NOT EXISTS "RopewikiAkaName_name_trgm"
    ON public."RopewikiAkaName" USING gin ("name" gin_trgm_ops);

-- migrate:down

DROP INDEX IF EXISTS public."RopewikiAkaName_name_trgm";

ALTER TABLE "RopewikiPage"
    ADD COLUMN "aka" jsonb;

-- Restore aka from RopewikiAkaName (aggregate back to jsonb array)
UPDATE "RopewikiPage" p
SET "aka" = sub.agg
FROM (
    SELECT a."ropewikiPage",
           jsonb_agg(a."name" ORDER BY a."name") AS agg
    FROM "RopewikiAkaName" a
    WHERE a."deletedAt" IS NULL
    GROUP BY a."ropewikiPage"
) sub
WHERE sub."ropewikiPage" = p.id;

ALTER TABLE "RopewikiAkaName" DROP CONSTRAINT IF EXISTS "uk_ropewikiAkaName_ropewikiPage_name";
ALTER TABLE "RopewikiAkaName" DROP CONSTRAINT IF EXISTS "fk_ropewikiAkaName_ropewikiPage";

DROP TABLE IF EXISTS "RopewikiAkaName";
