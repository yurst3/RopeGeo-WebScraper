-- migrate:up

-- Enable trigram similarity for fuzzy name search (requires superuser or extension in allowed list on RDS)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for fast trigram search on page and region names
CREATE INDEX IF NOT EXISTS "RopewikiPage_name_trgm"
  ON public."RopewikiPage" USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "RopewikiRegion_name_trgm"
  ON public."RopewikiRegion" USING gin (name gin_trgm_ops);

-- migrate:down

DROP INDEX IF EXISTS public."RopewikiRegion_name_trgm";
DROP INDEX IF EXISTS public."RopewikiPage_name_trgm";
DROP EXTENSION IF EXISTS pg_trgm;
