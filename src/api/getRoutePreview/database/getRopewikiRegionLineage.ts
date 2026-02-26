import * as db from 'zapatos/db';

type LineageRow = { name: string; depth: number };

/**
 * Returns the name of the given region and the names of all its ancestors (parent, grandparent, etc.),
 * ordered from root (top-level) to the given region (leaf).
 * Uses a recursive CTE walking up the parentRegion chain.
 *
 * @param conn - Database connection
 * @param regionId - RopewikiRegion id (uuid)
 * @returns Array of region names, root first, or empty if region not found
 */
const getRopewikiRegionLineage = async (
    conn: db.Queryable,
    regionId: string,
): Promise<string[]> => {
    const rows = await db.sql<db.SQL, LineageRow[]>`
        WITH RECURSIVE lineage AS (
            SELECT id, name, "parentRegion", 1 AS depth
            FROM "RopewikiRegion"
            WHERE id = ${db.param(regionId)}::uuid
              AND "deletedAt" IS NULL
            UNION ALL
            SELECT r.id, r.name, r."parentRegion", l.depth + 1
            FROM "RopewikiRegion" r
            INNER JOIN lineage l ON r.name = l."parentRegion"
              AND r."deletedAt" IS NULL
        )
        SELECT name, depth FROM lineage ORDER BY depth DESC
    `.run(conn);

    return rows.map((row) => row.name);
};

export default getRopewikiRegionLineage;
