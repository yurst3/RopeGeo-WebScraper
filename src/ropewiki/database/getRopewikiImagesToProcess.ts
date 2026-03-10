import * as db from 'zapatos/db';

export type RopewikiImageToProcessRow = { id: string; fileUrl: string };

/**
 * Returns all RopewikiImages that need AVIF processing: same criteria as filterImagesToProcess —
 * either processedImage is null, or the processedImage's ImageData.sourceUrl differs from the
 * image's fileUrl (e.g. source URL changed).
 *
 * @param conn - Database connection
 * @returns Rows with id and fileUrl for each image to process
 */
const getRopewikiImagesToProcess = async (
    conn: db.Queryable,
): Promise<RopewikiImageToProcessRow[]> => {
    const rows = await db.sql<db.SQL, RopewikiImageToProcessRow[]>`
        SELECT i.id, i."fileUrl"
        FROM "RopewikiImage" i
        LEFT JOIN "ImageData" d ON d.id = i."processedImage"
        WHERE i."deletedAt" IS NULL
          AND (i."processedImage" IS NULL OR d."sourceUrl" IS DISTINCT FROM i."fileUrl")
    `.run(conn);
    return rows;
};

export default getRopewikiImagesToProcess;
