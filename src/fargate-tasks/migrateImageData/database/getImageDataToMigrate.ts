import * as db from 'zapatos/db';

export interface ImageDataRowToMigrate {
    id: string;
    previewUrl: string | null;
    bannerUrl: string | null;
    sourceUrl: string | null;
    losslessUrl: string | null;
}

/**
 * Fetches ImageData rows that need migration: fullUrl is NULL, losslessUrl is set,
 * no error, not deleted. These rows have the legacy full.avif at S3 key {id}/full.avif.
 */
export const getImageDataToMigrate = async (
    conn: db.Queryable,
): Promise<ImageDataRowToMigrate[]> => {
    const rows = await db.sql<
        db.SQL,
        { id: string; previewUrl: string | null; bannerUrl: string | null; sourceUrl: string | null; losslessUrl: string | null }[]
    >`
        SELECT id, "previewUrl", "bannerUrl", "sourceUrl", "losslessUrl"
        FROM "ImageData"
        WHERE "fullUrl" IS NULL
          AND "losslessUrl" IS NOT NULL
          AND "errorMessage" IS NULL
          AND "deletedAt" IS NULL
        ORDER BY id
    `.run(conn);

    return rows.map((r) => ({
        id: r.id,
        previewUrl: r.previewUrl,
        bannerUrl: r.bannerUrl,
        sourceUrl: r.sourceUrl,
        losslessUrl: r.losslessUrl,
    }));
};
