import * as db from 'zapatos/db';

/**
 * Returns the given region id and all descendant region ids (for ancestry filtering).
 * If regionId is null, returns all non-deleted region ids (no filter).
 */
async function getAllowedRegionIds(
    conn: db.Queryable,
    regionId: string | null,
): Promise<string[]> {
    const rows = await db.sql<db.SQL, { id: string }[]>`
        WITH RECURSIVE region_and_descendants AS (
            SELECT id, name FROM "RopewikiRegion"
            WHERE "deletedAt" IS NULL
              AND (${db.param(regionId)}::uuid IS NULL OR id = ${db.param(regionId)}::uuid)
            UNION ALL
            SELECT r.id, r.name FROM "RopewikiRegion" r
            INNER JOIN region_and_descendants d ON (
                r."parentRegion" = d.name OR r."parentRegion" = d.id::text
            )
            WHERE r."deletedAt" IS NULL
              AND ${db.param(regionId)}::uuid IS NOT NULL
        )
        SELECT id FROM region_and_descendants
    `.run(conn);
    return rows.map((r) => r.id);
}

export default getAllowedRegionIds;
