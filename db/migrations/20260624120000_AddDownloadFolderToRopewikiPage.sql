-- migrate:up
ALTER TABLE "RopewikiPage"
  ADD COLUMN "downloadFolder" text,
  ADD COLUMN "downloadFolderBuiltAt" timestamp without time zone;

-- migrate:down
ALTER TABLE "RopewikiPage"
  DROP COLUMN IF EXISTS "downloadFolderBuiltAt",
  DROP COLUMN IF EXISTS "downloadFolder";
