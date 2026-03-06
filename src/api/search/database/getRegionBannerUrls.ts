import * as db from 'zapatos/db';

type Row = { region_id: string; fileUrl: string | null };

/**
 * For each region id, returns the banner image fileUrl of that region's most popular page.
 * "Most popular" = max(quality * COALESCE(userVotes, 1)).
 * A region's pages include pages in the region and all its descendant regions at every level
 * (e.g. Utah's most popular page may be in West Zion > Heaps Canyon, multiple levels deep).
 * parentRegion is matched by descendant name (production) or by descendant id (some tests).
 * Banner = first RopewikiImage for that page with betaSection IS NULL, ordered by "order".
 *
 * @param conn - Database connection
 * @param regionIds - Region uuid strings
 * @returns Map from region id to fileUrl (or null if no page/image)
 */
const getRegionBannerUrls = async (
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
                r2."parentRegion" = rd.descendant_name
                OR r2."parentRegion" = rd.descendant_id::text
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
            ) AS "fileUrl"
        FROM best_pages bp
    `.run(conn);

    const map = new Map<string, string | null>();
    for (const r of rows) {
        map.set(r.region_id, r.fileUrl ?? null);
    }
    return map;
};

export default getRegionBannerUrls;
