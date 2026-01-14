-- migrate:up

CREATE TABLE "Route" (
    "id" uuid PRIMARY KEY,
    "name" text NOT NULL,
    "type" text NOT NULL,
    "coordinates" jsonb NOT NULL,
    "createdAt" timestamp DEFAULT current_timestamp NOT NULL,
    "updatedAt" timestamp DEFAULT current_timestamp NOT NULL,
    "deletedAt" timestamp
);

CREATE TABLE "RopewikiRoute" (
    "route" uuid NOT NULL,
    "ropewikiPage" uuid NOT NULL,
    "vectorTile" uuid,
    "createdAt" timestamp DEFAULT current_timestamp NOT NULL,
    "updatedAt" timestamp DEFAULT current_timestamp NOT NULL,
    "deletedAt" timestamp
);

-- Foreign key constraints
ALTER TABLE "RopewikiRoute"
    ADD CONSTRAINT "fk_ropewikiRoute_route" 
    FOREIGN KEY ("route") REFERENCES "Route"("id");

ALTER TABLE "RopewikiRoute"
    ADD CONSTRAINT "fk_ropewikiRoute_ropewikiPage" 
    FOREIGN KEY ("ropewikiPage") REFERENCES "RopewikiPage"("id");

-- Unique constraints
ALTER TABLE "RopewikiRoute"
    ADD CONSTRAINT "uk_ropewikiRoute_route_ropewikiPage" 
    UNIQUE ("route", "ropewikiPage");

ALTER TABLE "RopewikiRoute"
    ADD CONSTRAINT "uk_ropewikiRoute_ropewikiPage" 
    UNIQUE ("ropewikiPage");

-- migrate:down

ALTER TABLE "RopewikiRoute" DROP CONSTRAINT IF EXISTS "uk_ropewikiRoute_ropewikiPage";
ALTER TABLE "RopewikiRoute" DROP CONSTRAINT IF EXISTS "uk_ropewikiRoute_route_ropewikiPage";

ALTER TABLE "RopewikiRoute" DROP CONSTRAINT IF EXISTS "fk_ropewikiRoute_ropewikiPage";
ALTER TABLE "RopewikiRoute" DROP CONSTRAINT IF EXISTS "fk_ropewikiRoute_route";

DROP TABLE IF EXISTS "RopewikiRoute";
DROP TABLE IF EXISTS "Route";
