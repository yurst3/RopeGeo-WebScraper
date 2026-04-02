import * as db from 'zapatos/db';
import { RegionPreviewsCursor, RopewikiRegionPreviewsParams } from 'ropegeo-common/classes';

type PaginationRow = { type: string; id: string; sort_key: number };

/** Build RegionPreviewsCursor for the next page from the last row. */
export function cursorFromRow(row: PaginationRow): RegionPreviewsCursor {
    return new RegionPreviewsCursor(Number(row.sort_key), row.type, row.id);
}

/**
 * Returns one page of (type, id, sort_key) for region previews: direct children of the given region only
 * (pages in that region + regions whose parent is that region). Ordered by quality (sort_key DESC, type ASC, id ASC).
 * Uses keyset pagination via RegionPreviewsCursor (sortKey, type, id).
 * The queried region itself is never included in the results.
 */
export async function getRegionPreviewsPageIds(
    conn: db.Queryable,
    parentRegionId: string,
    params: RopewikiRegionPreviewsParams,
): Promise<{ items: PaginationRow[]; hasMore: boolean }> {
    const { limit, cursor } = params;
    const limitPlusOne = limit + 1;

    const cursorCondition = cursor
        ? db.sql`AND (
      (sort_key < ${db.param(cursor.sortKey)})
      OR (sort_key = ${db.param(cursor.sortKey)} AND type > ${db.param(cursor.type)})
      OR (sort_key = ${db.param(cursor.sortKey)} AND type = ${db.param(cursor.type)} AND id > ${db.param(cursor.id)}::uuid)
    )`
        : db.sql``;

    const rows = await db.sql<db.SQL, PaginationRow[]>`
    WITH parent_region AS (
      SELECT id, name FROM "RopewikiRegion"
      WHERE id = ${db.param(parentRegionId)}::uuid AND "deletedAt" IS NULL
    ),
    direct_child_regions AS (
      SELECT r.id
      FROM "RopewikiRegion" r
      INNER JOIN parent_region pr ON (
        r."parentRegionName" = pr.name OR r."parentRegionName" = pr.id::text
      )
      WHERE r."deletedAt" IS NULL
    ),
    region_scores AS (
      SELECT DISTINCT ON (dcr.id) dcr.id AS region_id,
        (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1))::float AS score
      FROM direct_child_regions dcr
      INNER JOIN "RopewikiPage" p ON p.region = dcr.id AND p."deletedAt" IS NULL
      ORDER BY dcr.id, (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1)) DESC
    ),
    page_part AS (
      SELECT 'page' AS type, p.id,
        (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1))::float AS sort_key
      FROM "RopewikiPage" p
      INNER JOIN parent_region pr ON p.region = pr.id
      WHERE p."deletedAt" IS NULL
    ),
    region_rows AS (
      SELECT 'region' AS type, r.id, COALESCE(rs.score, -1)::float AS sort_key
      FROM "RopewikiRegion" r
      INNER JOIN direct_child_regions dcr ON dcr.id = r.id
      LEFT JOIN region_scores rs ON rs.region_id = r.id
      WHERE r."deletedAt" IS NULL
    ),
    combined AS (
      (SELECT type, id, sort_key FROM page_part WHERE id IS NOT NULL)
      UNION ALL
      (SELECT type, id, sort_key FROM region_rows WHERE id IS NOT NULL)
    ),
    filtered AS (
      SELECT type, id, sort_key FROM combined
      WHERE id IS NOT NULL
      ${cursorCondition}
    )
    SELECT type, id, sort_key FROM filtered
    ORDER BY sort_key DESC, type ASC, id ASC
    LIMIT ${db.param(limitPlusOne)}
  `.run(conn);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, hasMore };
}
