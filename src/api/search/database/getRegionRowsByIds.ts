import * as db from 'zapatos/db';

export type RegionRow = {
    id: string;
    name: string;
    url: string;
    pageCount: number;
    regionCount: number;
};

/**
 * Fetches region rows (id, name, url, pageCount, regionCount) for the given region ids.
 * pageCount is truePageCountWithDescendents; regionCount is trueRegionCount.
 * Only returns non-deleted regions. Map is keyed by region id.
 */
async function getRegionRowsByIds(
    conn: db.Queryable,
    regionIds: string[],
): Promise<Map<string, RegionRow>> {
    if (regionIds.length === 0) return new Map();
    const rows = await db.sql<db.SQL, { id: string; name: string; url: string; truePageCountWithDescendents: number | null; trueRegionCount: number | null }[]>`
        SELECT id, name, url, "truePageCountWithDescendents", "trueRegionCount"
        FROM "RopewikiRegion"
        WHERE "deletedAt" IS NULL AND id = ANY(${db.param(regionIds)}::uuid[])
    `.run(conn);
    return new Map(
        rows.map((r) => [
            r.id,
            {
                id: r.id,
                name: r.name,
                url: r.url,
                pageCount: r.truePageCountWithDescendents ?? 0,
                regionCount: r.trueRegionCount ?? 0,
            },
        ]),
    );
}

export default getRegionRowsByIds;
