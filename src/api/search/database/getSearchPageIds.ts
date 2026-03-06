import * as db from 'zapatos/db';
import { SearchCursor, SearchParams } from 'ropegeo-common';

type PaginationRow = { type: string; id: string; sort_key: number };

/**
 * Returns one page of (type, id, sort_key) for search, ordered by sort_key DESC, type ASC, id ASC.
 * Uses keyset pagination: when cursor is provided, only rows "after" the cursor are returned.
 * Fetches limit+1 rows to detect hasMore; the last of the first `limit` becomes the nextCursor.
 * @param allowedRegionIds - Region ids to include (e.g. from getAllowedRegionIds(conn, params.regionId))
 */
export async function getSearchPageIds(
    conn: db.Queryable,
    params: SearchParams,
    allowedRegionIds: string[],
): Promise<{ items: SearchCursor[]; hasMore: boolean }> {
    const {
        name,
        similarityThreshold,
        includePages,
        includeRegions,
        includeAka,
        order,
        limit,
        cursor,
    } = params;

    const limitPlusOne = limit + 1;

    if (order === 'similarity') {
        const pageByName = includePages
            ? db.sql`
        SELECT 'page' AS type, p.id, word_similarity(${db.param(name)}, p.name)::float AS sort_key
        FROM "RopewikiPage" p
        INNER JOIN "RopewikiRegion" r ON r.id = p.region AND r."deletedAt" IS NULL
        WHERE p."deletedAt" IS NULL
          AND word_similarity(${db.param(name)}, p.name) > ${db.param(similarityThreshold)}
          AND p.region = ANY(${db.param(allowedRegionIds)}::uuid[])
      `
            : db.sql`SELECT 'page' AS type, NULL::uuid AS id, 0::float AS sort_key WHERE FALSE`;
        const pageByAka = includePages && includeAka
            ? db.sql`
        SELECT 'page' AS type, p.id, word_similarity(${db.param(name)}, a.name)::float AS sort_key
        FROM "RopewikiPage" p
        INNER JOIN "RopewikiRegion" r ON r.id = p.region AND r."deletedAt" IS NULL
        INNER JOIN "RopewikiAkaName" a ON a."ropewikiPage" = p.id AND a."deletedAt" IS NULL
        WHERE p."deletedAt" IS NULL
          AND word_similarity(${db.param(name)}, a.name) > ${db.param(similarityThreshold)}
          AND p.region = ANY(${db.param(allowedRegionIds)}::uuid[])
      `
            : db.sql`SELECT 'page' AS type, NULL::uuid AS id, 0::float AS sort_key WHERE FALSE`;
        const pagePart = includeAka && includePages
            ? db.sql`
        SELECT type, id, max(sort_key)::float AS sort_key
        FROM ((${pageByName}) UNION ALL (${pageByAka})) AS u
        WHERE id IS NOT NULL
        GROUP BY type, id
      `
            : pageByName;
        const regionPart = includeRegions
            ? db.sql`
        SELECT 'region' AS type, r.id, word_similarity(${db.param(name)}, r.name)::float AS sort_key
        FROM "RopewikiRegion" r
        WHERE r."deletedAt" IS NULL
          AND word_similarity(${db.param(name)}, r.name) > ${db.param(similarityThreshold)}
          AND r.id = ANY(${db.param(allowedRegionIds)}::uuid[])
      `
            : db.sql`SELECT 'region' AS type, NULL::uuid AS id, 0::float AS sort_key WHERE FALSE`;

        const cursorCondition = cursor
            ? db.sql`AND (
          (sort_key < ${db.param(cursor.sortKey)})
          OR (sort_key = ${db.param(cursor.sortKey)} AND type > ${db.param(cursor.type)})
          OR (sort_key = ${db.param(cursor.sortKey)} AND type = ${db.param(cursor.type)} AND id > ${db.param(cursor.id)}::uuid)
        )`
            : db.sql``;

        const rows = await db.sql<db.SQL, PaginationRow[]>`
        WITH combined AS (
          (${pagePart})
          UNION ALL
          (${regionPart})
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
        const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => new SearchCursor(
            Number(r.sort_key),
            r.type as 'page' | 'region',
            r.id,
        ));
        return { items, hasMore };
    }

    const cursorCondition = cursor
        ? db.sql`AND (
      (sort_key < ${db.param(cursor.sortKey)})
      OR (sort_key = ${db.param(cursor.sortKey)} AND type > ${db.param(cursor.type)})
      OR (sort_key = ${db.param(cursor.sortKey)} AND type = ${db.param(cursor.type)} AND id > ${db.param(cursor.id)}::uuid)
    )`
        : db.sql``;

    const pageByNameQuality = includePages
        ? db.sql`
    SELECT 'page' AS type, p.id,
      (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1))::float AS sort_key
    FROM "RopewikiPage" p
    INNER JOIN "RopewikiRegion" r ON r.id = p.region AND r."deletedAt" IS NULL
    WHERE p."deletedAt" IS NULL
      AND word_similarity(${db.param(name)}, p.name) > ${db.param(similarityThreshold)}
      AND p.region = ANY(${db.param(allowedRegionIds)}::uuid[])
  `
        : db.sql`SELECT 'page' AS type, NULL::uuid AS id, 0::float AS sort_key WHERE FALSE`;
    const pageByAkaQuality = includePages && includeAka
        ? db.sql`
    SELECT 'page' AS type, p.id,
      (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1))::float AS sort_key
    FROM "RopewikiPage" p
    INNER JOIN "RopewikiRegion" r ON r.id = p.region AND r."deletedAt" IS NULL
    INNER JOIN "RopewikiAkaName" a ON a."ropewikiPage" = p.id AND a."deletedAt" IS NULL
    WHERE p."deletedAt" IS NULL
      AND word_similarity(${db.param(name)}, a.name) > ${db.param(similarityThreshold)}
      AND p.region = ANY(${db.param(allowedRegionIds)}::uuid[])
  `
        : db.sql`SELECT 'page' AS type, NULL::uuid AS id, 0::float AS sort_key WHERE FALSE`;
    const pagePartQuality = includeAka && includePages
        ? db.sql`
    SELECT type, id, max(sort_key)::float AS sort_key
    FROM ((${pageByNameQuality}) UNION ALL (${pageByAkaQuality})) AS u
    WHERE id IS NOT NULL
    GROUP BY type, id
  `
        : pageByNameQuality;

    const rows = await db.sql<db.SQL, PaginationRow[]>`
    WITH RECURSIVE rd AS (
      SELECT id AS region_id, id AS descendant_id, name AS descendant_name
      FROM "RopewikiRegion"
      WHERE id = ANY(${db.param(allowedRegionIds)}::uuid[]) AND "deletedAt" IS NULL
      UNION ALL
      SELECT rd.region_id, r2.id, r2.name
      FROM "RopewikiRegion" r2
      INNER JOIN rd ON (
        r2."parentRegion" = rd.descendant_name
        OR r2."parentRegion" = rd.descendant_id::text
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
        AND word_similarity(${db.param(name)}, r.name) > ${db.param(similarityThreshold)}
        AND r.id = ANY(${db.param(allowedRegionIds)}::uuid[])
        AND ${db.param(includeRegions)}
    ),
    combined AS (
      (${pagePartQuality})
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
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => new SearchCursor(
        Number(r.sort_key),
        r.type as 'page' | 'region',
        r.id,
    ));
    return { items, hasMore };
}
