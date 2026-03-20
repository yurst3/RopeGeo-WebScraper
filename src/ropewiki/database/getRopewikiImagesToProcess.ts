import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { RopewikiImage } from '../types/image';

/**
 * Returns RopewikiImages that need AVIF processing.
 *
 * @param onlyUnprocessed - When true (default), only rows with processedImage IS NULL (download path only).
 * @param downloadSource - When true (default), include never-processed and/or source-mismatch rows per onlyUnprocessed.
 *   When false, only rows with processedImage IS NOT NULL. If onlyUnprocessed is also true, returns no rows.
 */
const getRopewikiImagesToProcess = async (
    conn: db.Queryable,
    onlyUnprocessed: boolean = true,
    downloadSource: boolean = true,
): Promise<RopewikiImage[]> => {
    if (!downloadSource && onlyUnprocessed) {
        return [];
    }
    if (downloadSource) {
        if (onlyUnprocessed) {
            const rows = await db.sql<db.SQL, s.RopewikiImage.JSONSelectable[]>`
                SELECT i.*
                FROM "RopewikiImage" i
                WHERE i."deletedAt" IS NULL
                  AND i."processedImage" IS NULL
            `.run(conn);
            return rows.map((row) => RopewikiImage.fromDbRow(row));
        }
        const rows = await db.sql<db.SQL, s.RopewikiImage.JSONSelectable[]>`
            SELECT i.*
            FROM "RopewikiImage" i
            LEFT JOIN "ImageData" d ON d.id = i."processedImage"
            WHERE i."deletedAt" IS NULL
              AND (i."processedImage" IS NULL OR d."sourceUrl" IS DISTINCT FROM i."fileUrl")
        `.run(conn);
        return rows.map((row) => RopewikiImage.fromDbRow(row));
    }
    const rows = await db.sql<db.SQL, s.RopewikiImage.JSONSelectable[]>`
        SELECT i.*
        FROM "RopewikiImage" i
        INNER JOIN "ImageData" d ON d.id = i."processedImage"
        WHERE i."deletedAt" IS NULL
          AND i."processedImage" IS NOT NULL
          AND d."sourceUrl" IS DISTINCT FROM i."fileUrl"
    `.run(conn);
    return rows.map((row) => RopewikiImage.fromDbRow(row));
};

export default getRopewikiImagesToProcess;
