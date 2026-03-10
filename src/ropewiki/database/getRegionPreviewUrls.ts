import * as db from 'zapatos/db';

type Row = { region_id: string; fileUrl: string | null; processedImage: string | null };

/**
 * For each region id, returns the processed preview.avif URL of that region's most popular page's banner image.
 * Returns null when no image or no processed ImageData. "Most popular" = max(quality * COALESCE(userVotes, 1)).
 * A region's pages include pages in the region and all its descendant regions at every level
 * (e.g. Utah's most popular page may be in West Zion > Heaps Canyon, multiple levels deep).
 * parentRegionName is matched by descendant name (production) or by descendant id (some tests).
 * Banner = first RopewikiImage for that page with betaSection IS NULL, ordered by "order".
 *
 * @param conn - Database connection
 * @param regionIds - Region uuid strings
 * @returns Map from region id to resolved preview URL (or null if no page/image)
 */
const getRegionPreviewUrls = async (
    conn: db.Queryable,
    regionIds: string[],
): Promise<Map<string, string | null>> => {
    if (regionIds.length === 0) {
        return new Map();
    }

    const rows = await db.sql<db.SQL, Row[]>`
        WITH RECURSIVE rd AS (
            SELECT id AS region_id, id AS descendant_id, name AS descendant_name
            FROM "RopewikiRegion"
            WHERE id = ANY(${db.param(regionIds)}::uuid[])
              AND "deletedAt" IS NULL
            UNION ALL
            SELECT rd.region_id, r2.id, r2.name
            FROM "RopewikiRegion" r2
            INNER JOIN rd ON (
                r2."parentRegionName" = rd.descendant_name
                OR r2."parentRegionName" = rd.descendant_id::text
            )
            WHERE r2."deletedAt" IS NULL
        ),
        best_pages AS (
            SELECT DISTINCT ON (rd.region_id) rd.region_id, p.id AS page_id
            FROM rd
            INNER JOIN "RopewikiPage" p
              ON p.region = rd.descendant_id AND p."deletedAt" IS NULL
            ORDER BY rd.region_id,
              (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1)) DESC
        )
        SELECT
            bp.region_id,
            (
                SELECT i."fileUrl"
                FROM "RopewikiImage" i
                WHERE i."ropewikiPage" = bp.page_id
                  AND i."betaSection" IS NULL
                  AND i."deletedAt" IS NULL
                ORDER BY i."order" ASC NULLS LAST
                LIMIT 1
            ) AS "fileUrl",
            (
                SELECT i."processedImage"
                FROM "RopewikiImage" i
                WHERE i."ropewikiPage" = bp.page_id
                  AND i."betaSection" IS NULL
                  AND i."deletedAt" IS NULL
                ORDER BY i."order" ASC NULLS LAST
                LIMIT 1
            ) AS "processedImage"
        FROM best_pages bp
    `.run(conn);

    const processedImageIds = [...new Set(rows.map((r) => r.processedImage).filter((id): id is string => id != null))];
    const imageDataRows = processedImageIds.length > 0
        ? await db.select('ImageData', { id: db.conditions.isIn(processedImageIds) }, { columns: ['id', 'previewUrl', 'errorMessage'] }).run(conn)
        : [];
    const imageDataById = new Map(imageDataRows.map((r) => [r.id, r]));

    const map = new Map<string, string | null>();
    for (const r of rows) {
        const imageData = r.processedImage ? imageDataById.get(r.processedImage) : null;
        const url =
            imageData && imageData.errorMessage == null && imageData.previewUrl
                ? imageData.previewUrl
                : null;
        map.set(r.region_id, url);
    }
    return map;
};

export default getRegionPreviewUrls;
