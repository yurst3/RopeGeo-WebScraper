-- migrate:up

-- "full" is a reserved word in SQL; rename to "fullUrl" if the column was created as "full" (older migration)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ImageData' AND column_name = 'full') THEN
        ALTER TABLE "ImageData" RENAME COLUMN "full" TO "fullUrl";
    END IF;
END $$;

-- migrate:down

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ImageData' AND column_name = 'fullUrl') THEN
        ALTER TABLE "ImageData" RENAME COLUMN "fullUrl" TO "full";
    END IF;
END $$;
