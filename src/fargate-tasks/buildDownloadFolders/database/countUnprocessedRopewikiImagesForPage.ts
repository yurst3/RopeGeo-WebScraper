import * as db from 'zapatos/db';

/** Counts non-deleted Ropewiki page images missing processed ImageData or with processing errors. */
export async function countUnprocessedRopewikiImagesForPage(
    conn: db.Queryable,
    pageId: string,
): Promise<number> {
    const rows = await db.sql<db.SQL, { c: string }[]>`
        SELECT COUNT(*)::text AS c
        FROM "RopewikiImage" i
        LEFT JOIN "ImageData" d ON d.id = i."processedImage"
        WHERE i."ropewikiPage" = ${db.param(pageId)}::uuid
          AND i."deletedAt" IS NULL
          AND (
            i."processedImage" IS NULL
            OR d."errorMessage" IS NOT NULL
          )
    `.run(conn);
    return parseInt(rows[0]?.c ?? '0', 10);
}
