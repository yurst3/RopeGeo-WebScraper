-- migrate:up
ALTER TABLE "ImageData" ADD COLUMN "linkPreviewUrl" text;

-- Backfill mimeType on encoded variant objects (preview/banner/full/lossless) where missing.
DO $$
DECLARE
  r RECORD;
  m jsonb;
  k text;
  v jsonb;
BEGIN
  FOR r IN SELECT id, metadata FROM "ImageData" WHERE metadata IS NOT NULL AND metadata != 'null'::jsonb
  LOOP
    m := r.metadata;
    IF jsonb_typeof(m) != 'object' THEN
      CONTINUE;
    END IF;
    FOREACH k IN ARRAY ARRAY['preview', 'banner', 'full', 'lossless']
    LOOP
      IF m ? k AND jsonb_typeof(m -> k) = 'object' AND NOT (m -> k ? 'mimeType') THEN
        v := (m -> k) || jsonb_build_object('mimeType', 'image/avif');
        m := jsonb_set(m, ARRAY[k], v);
      END IF;
    END LOOP;
    UPDATE "ImageData" SET metadata = m WHERE id = r.id;
  END LOOP;
END $$;

-- migrate:down
ALTER TABLE "ImageData" DROP COLUMN IF EXISTS "linkPreviewUrl";
