-- migrate:up

-- Add allowUpdates audit column (default true) to every table.
-- When false, application logic prevents updating the row.
ALTER TABLE "MapData"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

ALTER TABLE "RopewikiAkaName"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

ALTER TABLE "RopewikiBetaSection"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

ALTER TABLE "RopewikiImage"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

ALTER TABLE "RopewikiPage"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

ALTER TABLE "RopewikiPageSiteLink"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

ALTER TABLE "RopewikiRegion"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

ALTER TABLE "RopewikiRoute"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

ALTER TABLE "RopewikiSiteLink"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

ALTER TABLE "Route"
    ADD COLUMN "allowUpdates" boolean DEFAULT true NOT NULL;

-- migrate:down

ALTER TABLE "Route"
    DROP COLUMN IF EXISTS "allowUpdates";

ALTER TABLE "RopewikiSiteLink"
    DROP COLUMN IF EXISTS "allowUpdates";

ALTER TABLE "RopewikiRoute"
    DROP COLUMN IF EXISTS "allowUpdates";

ALTER TABLE "RopewikiRegion"
    DROP COLUMN IF EXISTS "allowUpdates";

ALTER TABLE "RopewikiPageSiteLink"
    DROP COLUMN IF EXISTS "allowUpdates";

ALTER TABLE "RopewikiPage"
    DROP COLUMN IF EXISTS "allowUpdates";

ALTER TABLE "RopewikiImage"
    DROP COLUMN IF EXISTS "allowUpdates";

ALTER TABLE "RopewikiBetaSection"
    DROP COLUMN IF EXISTS "allowUpdates";

ALTER TABLE "RopewikiAkaName"
    DROP COLUMN IF EXISTS "allowUpdates";

ALTER TABLE "MapData"
    DROP COLUMN IF EXISTS "allowUpdates";
