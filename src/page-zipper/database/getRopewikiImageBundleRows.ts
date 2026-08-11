import * as db from 'zapatos/db';
import type { ImageBundleRow } from '../processors/processSourceFolders';

/** Processed Ropewiki page images with preview/banner/full URLs for bundling into the download ZIP. */
export async function getRopewikiImageBundleRows(
    conn: db.Queryable,
    pageId: string,
): Promise<ImageBundleRow[]> {
    return db.sql<db.SQL, ImageBundleRow[]>`
        SELECT
            i.id AS "imageId",
            i."processedImage" AS "processedImageId",
            d."previewUrl",
            d."bannerUrl",
            d."fullUrl"
        FROM "RopewikiImage" i
        INNER JOIN "ImageData" d ON d.id = i."processedImage" AND d."errorMessage" IS NULL
        WHERE i."ropewikiPage" = ${db.param(pageId)}::uuid
          AND i."deletedAt" IS NULL
    `.run(conn);
}
