-- migrate:up

CREATE TABLE "RopewikiSiteLink" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "url" text NOT NULL,
    "createdAt" timestamp DEFAULT current_timestamp NOT NULL,
    "updatedAt" timestamp DEFAULT current_timestamp NOT NULL,
    "deletedAt" timestamp
);

CREATE TABLE "RopewikiPageSiteLink" (
    "page" uuid NOT NULL,
    "siteLink" uuid NOT NULL,
    "createdAt" timestamp DEFAULT current_timestamp NOT NULL,
    "updatedAt" timestamp DEFAULT current_timestamp NOT NULL,
    "deletedAt" timestamp
);

ALTER TABLE "RopewikiPageSiteLink"
    ADD CONSTRAINT "fk_ropewikiPageSiteLink_page"
    FOREIGN KEY ("page") REFERENCES "RopewikiPage"("id");

ALTER TABLE "RopewikiPageSiteLink"
    ADD CONSTRAINT "fk_ropewikiPageSiteLink_siteLink"
    FOREIGN KEY ("siteLink") REFERENCES "RopewikiSiteLink"("id");

ALTER TABLE "RopewikiPageSiteLink"
    ADD CONSTRAINT "uk_ropewikiPageSiteLink_page_siteLink"
    UNIQUE ("page", "siteLink");

ALTER TABLE "RopewikiSiteLink"
    ADD CONSTRAINT "uk_ropewikiSiteLink_url" UNIQUE ("url");

-- Migrate betaSites to RopewikiSiteLink and RopewikiPageSiteLink
INSERT INTO "RopewikiSiteLink" ("url")
SELECT DISTINCT elem
FROM "RopewikiPage",
     jsonb_array_elements_text("betaSites") AS elem
WHERE "betaSites" IS NOT NULL
  AND jsonb_array_length("betaSites") > 0
ON CONFLICT ("url") DO NOTHING;

INSERT INTO "RopewikiPageSiteLink" ("page", "siteLink")
SELECT p.id, s.id
FROM "RopewikiPage" p
CROSS JOIN LATERAL jsonb_array_elements_text(p."betaSites") AS url_elem
JOIN "RopewikiSiteLink" s ON s."url" = url_elem
WHERE p."betaSites" IS NOT NULL
  AND jsonb_array_length(p."betaSites") > 0
ON CONFLICT ("page", "siteLink") DO NOTHING;

ALTER TABLE "RopewikiPage"
    DROP COLUMN "betaSites";

-- migrate:down

ALTER TABLE "RopewikiPage"
    ADD COLUMN "betaSites" jsonb;

UPDATE "RopewikiPage" p
SET "betaSites" = sub.agg
FROM (
    SELECT ps."page", jsonb_agg(s."url" ORDER BY s."url") AS agg
    FROM "RopewikiPageSiteLink" ps
    JOIN "RopewikiSiteLink" s ON s.id = ps."siteLink"
    WHERE ps."deletedAt" IS NULL
      AND s."deletedAt" IS NULL
    GROUP BY ps."page"
) sub
WHERE sub."page" = p.id;

ALTER TABLE "RopewikiPageSiteLink" DROP CONSTRAINT IF EXISTS "uk_ropewikiPageSiteLink_page_siteLink";
ALTER TABLE "RopewikiPageSiteLink" DROP CONSTRAINT IF EXISTS "fk_ropewikiPageSiteLink_siteLink";
ALTER TABLE "RopewikiPageSiteLink" DROP CONSTRAINT IF EXISTS "fk_ropewikiPageSiteLink_page";

ALTER TABLE "RopewikiSiteLink" DROP CONSTRAINT IF EXISTS "uk_ropewikiSiteLink_url";

DROP TABLE IF EXISTS "RopewikiPageSiteLink";
DROP TABLE IF EXISTS "RopewikiSiteLink";
