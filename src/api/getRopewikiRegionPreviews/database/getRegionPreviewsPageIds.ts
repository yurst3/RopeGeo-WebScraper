import * as db from 'zapatos/db';
import { RegionPreviewsCursor, RopewikiRegionPreviewsParams } from 'ropegeo-common';

type PaginationRow = { type: string; id: string; sort_key: number };

/** Build RegionPreviewsCursor for the next page from the last row. */
export function cursorFromRow(row: PaginationRow): RegionPreviewsCursor {
    return new RegionPreviewsCursor(Number(row.sort_key), row.type, row.id);
}

/**
 * Returns one page of (type, id, sort_key) for region previews, ordered by quality (sort_key DESC, type ASC, id ASC).
 * Uses the same quality ordering as search: sort_key = (quality * userVotes) for pages; for regions, max such score in that region.
 * Uses keyset pagination via RegionPreviewsCursor (sortKey, type, id).
 */
export async function getRegionPreviewsPageIds(
    conn: db.Queryable,
    allowedRegionIds: string[],
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

    const pagePart = db.sql`
    SELECT 'page' AS type, p.id,
      (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1))::float AS sort_key
    FROM "RopewikiPage" p
    INNER JOIN "RopewikiRegion" r ON r.id = p.region AND r."deletedAt" IS NULL
    WHERE p."deletedAt" IS NULL
      AND p.region = ANY(${db.param(allowedRegionIds)}::uuid[])
  `;

    const rows = await db.sql<db.SQL, PaginationRow[]>`
    WITH RECURSIVE rd AS (
      SELECT id AS region_id, id AS descendant_id, name AS descendant_name
      FROM "RopewikiRegion"
      WHERE id = ANY(${db.param(allowedRegionIds)}::uuid[]) AND "deletedAt" IS NULL
      UNION ALL
      SELECT rd.region_id, r2.id, r2.name
      FROM "RopewikiRegion" r2
      INNER JOIN rd ON (
        r2."parentRegionName" = rd.descendant_name
        OR r2."parentRegionName" = rd.descendant_id::text
      )
      WHERE r2."deletedAt" IS NULL
    ),
    region_scores AS (
      SELECT DISTINCT ON (rd.region_id) rd.region_id,
        (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1))::float AS score
      FROM rd
      INNER JOIN "RopewikiPage" p ON p.region = rd.descendant_id AND p."deletedAt" IS NULL
      ORDER BY rd.region_id, (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1)) DESC
    ),
    region_rows AS (
      SELECT 'region' AS type, r.id, COALESCE(rs.score, -1)::float AS sort_key
      FROM "RopewikiRegion" r
      LEFT JOIN region_scores rs ON rs.region_id = r.id
      WHERE r."deletedAt" IS NULL
        AND r.id = ANY(${db.param(allowedRegionIds)}::uuid[])
    ),
    combined AS (
      (${pagePart})
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
