import * as db from 'zapatos/db';

/**
 * Returns raw ImageData.metadata JSON for the page's banner image (first RopewikiImage with
 * null betaSection, ordered by order), or null if none.
 */
const getBannerImageMetadataForPage = async (
    conn: db.Queryable,
    pageId: string,
): Promise<unknown | null> => {
    type Row = { metadata: db.JSONValue | null };
    const rows = await db.sql<db.SQL, Row[]>`
        SELECT d."metadata"
        FROM "RopewikiImage" i
        LEFT JOIN "ImageData" d ON d.id = i."processedImage"
        WHERE i."ropewikiPage" = ${db.param(pageId)}::uuid
          AND i."deletedAt" IS NULL
          AND i."betaSection" IS NULL
        ORDER BY i."order" ASC NULLS LAST
        LIMIT 1
    `.run(conn);
    const row = rows[0];
    return row?.metadata ?? null;
};

export default getBannerImageMetadataForPage;
