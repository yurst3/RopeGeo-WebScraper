-- migrate:up

CREATE TABLE "RoadTripRyanRegion" (
    "id" uuid PRIMARY KEY,
    "name" text NOT NULL,
    "url" text NOT NULL, 
    "parentRegion" uuid,
    "pageCount" integer NOT NULL,
    "createdAt" timestamp DEFAULT current_timestamp NOT NULL,
    "updatedAt" timestamp DEFAULT current_timestamp NOT NULL,
    "deletedAt" timestamp
);

CREATE TABLE "RoadTripRyanImage" (
    "id" uuid PRIMARY KEY,
    "url" text NOT NULL,
    "page" uuid,
    "caption" text,
    "region" uuid,
    "isBanner" boolean NOT NULL,
    "createdAt" timestamp DEFAULT current_timestamp NOT NULL,
    "updatedAt" timestamp DEFAULT current_timestamp NOT NULL,
    "deletedAt" timestamp
);

CREATE TABLE "RoadTripRyanRoute" (
    "route" uuid NOT NULL,
    "roadTripRyanPage" uuid NOT NULL,
    "mapData" uuid,
    "createdAt" timestamp DEFAULT current_timestamp NOT NULL,
    "updatedAt" timestamp DEFAULT current_timestamp NOT NULL,
    "deletedAt" timestamp
);

CREATE TABLE "RoadTripRyanPage" (
    "id" uuid PRIMARY KEY,
    "title" text NOT NULL,
    "url" text NOT NULL,
    "region" uuid NOT NULL,
    "rated" numeric,
    "length" numeric,
    "gpx" text,
    "season" text,
    "gear" text, 
    "rappels" integer,
    "water" text,
    "flashFlood" text,
    "permitRequired" boolean,
    "tags" jsonb,
    "maps" text,
    "permitLink" text,
    "createdAt" timestamp DEFAULT current_timestamp NOT NULL,
    "updatedAt" timestamp DEFAULT current_timestamp NOT NULL,
    "deletedAt" timestamp
);

CREATE TABLE "RoadTripRyanBetaSection" (
    "id" uuid PRIMARY KEY,
    "title" text NOT NULL,
    "text" text NOT NULL,
    "notes" jsonb, 
    "order" integer,
    "page" uuid,
    "region" uuid,
    "createdAt" timestamp DEFAULT current_timestamp NOT NULL,
    "updatedAt" timestamp DEFAULT current_timestamp NOT NULL,
    "deletedAt" timestamp
);

-- Foreign key constraints
ALTER TABLE "RoadTripRyanImage"
    ADD CONSTRAINT "fk_RoadTripRyanImage_page"
    FOREIGN KEY ("page") REFERENCES "RoadTripRyanPage"("id");

ALTER TABLE "RoadTripRyanImage"
    ADD CONSTRAINT "fk_RoadTripRyanImage_region"
    FOREIGN KEY ("region") REFERENCES "RoadTripRyanRegion"("id");


ALTER TABLE "RoadTripRyanRoute"
    ADD CONSTRAINT "fk_RoadTripRyanRoute_page"
    FOREIGN KEY ("roadTripRyanPage") REFERENCES "RoadTripRyanPage"("id");

ALTER TABLE "RoadTripRyanPage"
    ADD CONSTRAINT "fk_RoadTripRyanPage_region"
    FOREIGN KEY ("region") REFERENCES "RoadTripRyanRegion"("id");

ALTER TABLE "RoadTripRyanBetaSection"
    ADD CONSTRAINT "fk_RoadTripRyanBetaSection_page"
    FOREIGN KEY ("page") REFERENCES "RoadTripRyanPage"("id");

-- mapData column reserved for future MapData table; no FK until that table exists

ALTER TABLE "RoadTripRyanRoute"
    ADD CONSTRAINT "fk_RoadTripRyanRoute_route"
    FOREIGN KEY ("route") REFERENCES "Route"("id");

-- Unique constraints

ALTER TABLE "RoadTripRyanRegion"
    ADD CONSTRAINT "uk_RoadTripRyanRegion_name" 
    UNIQUE ("name");

ALTER TABLE "RoadTripRyanRegion"
    ADD CONSTRAINT "uk_RoadTripRyanRegion_url" 
    UNIQUE ("url");

ALTER TABLE "RoadTripRyanRegion"
    ADD CONSTRAINT "uk_RoadTripRyanRegion_id_parentRegion" 
    UNIQUE NULLS NOT DISTINCT ("id", "parentRegion");

ALTER TABLE "RoadTripRyanImage"
    ADD CONSTRAINT "uk_RoadTripRyanImage_url_region" 
    UNIQUE ("url", "region");

ALTER TABLE "RoadTripRyanImage"
    ADD CONSTRAINT "uk_RoadTripRyanImage_url_page" 
    UNIQUE ("url", "page");

ALTER TABLE "RoadTripRyanRoute"
    ADD CONSTRAINT "uk_RoadTripRyanRoute_route_page" 
    UNIQUE ("route", "roadTripRyanPage");

ALTER TABLE "RoadTripRyanPage"
    ADD CONSTRAINT "uk_RoadTripRyanPage_title" 
    UNIQUE ("title");

ALTER TABLE "RoadTripRyanPage"
    ADD CONSTRAINT "uk_RoadTripRyanPage_url" 
    UNIQUE ("url");

ALTER TABLE "RoadTripRyanBetaSection"
    ADD CONSTRAINT "uk_RoadTripRyanBetaSection_title_page" 
    UNIQUE ("title", "page");

ALTER TABLE "RoadTripRyanBetaSection"
    ADD CONSTRAINT "uk_RoadTripRyanBetaSection_title_region" 
    UNIQUE ("title", "region");

ALTER TABLE "RoadTripRyanBetaSection"
    ADD CONSTRAINT "uk_RoadTripRyanBetaSection_order_region" 
    UNIQUE ("order", "region");

ALTER TABLE "RoadTripRyanBetaSection"
    ADD CONSTRAINT "uk_RoadTripRyanBetaSection_order_page" 
    UNIQUE ("order", "page");

-- migrate:down
-- Drop in reverse dependency order (children before parents)

DROP TABLE IF EXISTS "RoadTripRyanImage";
DROP TABLE IF EXISTS "RoadTripRyanRoute";
DROP TABLE IF EXISTS "RoadTripRyanBetaSection";
DROP TABLE IF EXISTS "RoadTripRyanPage";
DROP TABLE IF EXISTS "RoadTripRyanRegion";

