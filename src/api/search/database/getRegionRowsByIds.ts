import * as db from 'zapatos/db';

export type RegionRow = {
    id: string;
    name: string;
    url: string;
    pageCount: number;
};

/**
 * Fetches region rows (id, name, url, pageCount) for the given region ids.
 * Only returns non-deleted regions. Map is keyed by region id.
 */
async function getRegionRowsByIds(
    conn: db.Queryable,
    regionIds: string[],
): Promise<Map<string, RegionRow>> {
    if (regionIds.length === 0) return new Map();
    const rows = await db.sql<db.SQL, RegionRow[]>`
        SELECT id, name, url, "pageCount"
        FROM "RopewikiRegion"
        WHERE "deletedAt" IS NULL AND id = ANY(${db.param(regionIds)}::uuid[])
    `.run(conn);
    return new Map(rows.map((r) => [r.id, r]));
}

export default getRegionRowsByIds;
