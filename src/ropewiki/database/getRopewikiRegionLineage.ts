import * as db from 'zapatos/db';

type LineageRow = { id: string; name: string; depth: number };

/**
 * Returns the given region and all its ancestors (parent, grandparent, etc.) as { id, name },
 * ordered from the given region (leaf) to root (ascending depth).
 * Uses a recursive CTE walking up the parentRegionName chain.
 *
 * @param conn - Database connection
 * @param regionId - RopewikiRegion id (uuid)
 * @returns Array of { id, name }, leaf first, or empty if region not found
 */
const getRopewikiRegionLineage = async (
    conn: db.Queryable,
    regionId: string,
): Promise<{ id: string; name: string }[]> => {
    const rows = await db.sql<db.SQL, LineageRow[]>`
        WITH RECURSIVE lineage AS (
            SELECT id, name, "parentRegionName", 1 AS depth
            FROM "RopewikiRegion"
            WHERE id = ${db.param(regionId)}::uuid
              AND "deletedAt" IS NULL
            UNION ALL
            SELECT r.id, r.name, r."parentRegionName", l.depth + 1
            FROM "RopewikiRegion" r
            INNER JOIN lineage l ON r.name = l."parentRegionName"
              AND r."deletedAt" IS NULL
        )
        SELECT id, name, depth FROM lineage ORDER BY depth ASC
    `.run(conn);

    return rows.map((row) => ({ id: row.id, name: row.name }));
};

export default getRopewikiRegionLineage;
