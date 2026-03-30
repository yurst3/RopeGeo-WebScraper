import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { RopewikiImage } from '../types/image';

/**
 * Returns RopewikiImages for image processing / reprocessing.
 *
 * @param onlyUnprocessed - When true (default), only rows with `processedImage IS NULL`. When false, any
 *   non-deleted row (subject to `downloadSource`).
 * @param downloadSource - When true (default), no constraint on ImageData. When false, only rows with a
 *   non-null `processedImage` whose joined `ImageData.losslessUrl` is non-null (so an existing lossless
 *   output exists to re-encode from without downloading the wiki file URL).
 *
 * When `downloadSource` is false and `onlyUnprocessed` is true, returns `[]` without querying (invalid
 * combination for callers; {@link ReprocessImagesEvent} rejects it at parse time).
 */
const getRopewikiImagesToProcess = async (
    conn: db.Queryable,
    onlyUnprocessed: boolean = true,
    downloadSource: boolean = true,
): Promise<RopewikiImage[]> => {
    if (!downloadSource && onlyUnprocessed) {
        return [];
    }

    const includeAllProcessStates = !onlyUnprocessed;

    const rows = await db.sql<db.SQL, s.RopewikiImage.JSONSelectable[]>`
        SELECT i.*
        FROM "RopewikiImage" i
        LEFT JOIN "ImageData" d ON d.id = i."processedImage"
        WHERE i."deletedAt" IS NULL
          AND (${db.param(includeAllProcessStates)} OR i."processedImage" IS NULL)
          AND (
            ${db.param(downloadSource)}
            OR (i."processedImage" IS NOT NULL AND d."losslessUrl" IS NOT NULL)
          )
    `.run(conn);

    return rows.map((row) => RopewikiImage.fromDbRow(row));
};

export default getRopewikiImagesToProcess;
