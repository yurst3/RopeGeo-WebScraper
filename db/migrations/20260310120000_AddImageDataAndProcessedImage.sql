-- migrate:up

-- Create ImageData table (processed AVIF variants and source URL; used by ImageProcessor)
CREATE TABLE "ImageData" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    preview text,
    banner text,
    "fullUrl" text,
    source text,
    "errorMessage" text,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone,
    "allowUpdates" boolean DEFAULT true NOT NULL,
    CONSTRAINT "ImageData_pkey" PRIMARY KEY (id)
);

-- Add processedImage column to RopewikiImage (FK to ImageData when processing has run)
ALTER TABLE "RopewikiImage"
    ADD COLUMN "processedImage" uuid;

ALTER TABLE "RopewikiImage"
    ADD CONSTRAINT "fk_ropewikiImage_processedImage"
    FOREIGN KEY ("processedImage") REFERENCES "ImageData"(id);

-- migrate:down

ALTER TABLE "RopewikiImage"
    DROP CONSTRAINT IF EXISTS "fk_ropewikiImage_processedImage";

ALTER TABLE "RopewikiImage"
    DROP COLUMN IF EXISTS "processedImage";

DROP TABLE IF EXISTS "ImageData";
