import * as db from 'zapatos/db';
import type { BannerImageLinkContext } from '../util/pageViewToLinkPreview';

/**
 * Returns raw ImageData.metadata and linkPreviewUrl for the page's banner image (first RopewikiImage with
 * null betaSection). Returns null if there is no such row; if the row exists but `processedImage` is null,
 * the LEFT JOIN yields `{ metadata: null, linkPreviewUrl: null }`.
 */
const getBannerImageMetadataForPage = async (
    conn: db.Queryable,
    pageId: string,
): Promise<BannerImageLinkContext | null> => {
    type Row = { metadata: db.JSONValue | null; linkPreviewUrl: string | null };
    const rows = await db.sql<db.SQL, Row[]>`
        SELECT d."metadata", d."linkPreviewUrl"
        FROM "RopewikiImage" i
        LEFT JOIN "ImageData" d ON d.id = i."processedImage"
        WHERE i."ropewikiPage" = ${db.param(pageId)}::uuid
          AND i."deletedAt" IS NULL
          AND i."betaSection" IS NULL
        ORDER BY i."order" ASC NULLS LAST
        LIMIT 1
    `.run(conn);
    const row = rows[0];
    if (row == null) {
        return null;
    }
    return {
        metadata: row.metadata ?? null,
        linkPreviewUrl: row.linkPreviewUrl ?? null,
    };
};

export default getBannerImageMetadataForPage;
