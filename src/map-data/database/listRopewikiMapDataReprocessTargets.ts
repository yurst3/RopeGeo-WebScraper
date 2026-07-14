import type { PoolClient } from 'pg';

export type RopewikiMapDataReprocessTarget = {
    routeId: string;
    pageId: string;
    mapDataId: string;
};

/**
 * Rows suitable for enqueueing to MapDataProcessingQueue: active Ropewiki routes with MapData.
 * When `onlyWithStoredKmlOrGpx` is true, limits to MapData rows that have a stored KML or GPX key
 * (so {@link processMapData} can use `downloadSource: false` with S3 `source/{id}.kml|gpx`).
 * When `includeMapDataIds` is set, only those MapData ids are considered.
 */
export async function listRopewikiMapDataReprocessTargets(
    client: PoolClient,
    onlyWithStoredKmlOrGpx: boolean,
    includeMapDataIds?: string[],
): Promise<RopewikiMapDataReprocessTarget[]> {
    const sql = `
        SELECT r.route::text AS "routeId",
               r."ropewikiPage"::text AS "pageId",
               m.id::text AS "mapDataId"
        FROM "RopewikiRoute" r
        INNER JOIN "MapData" m ON m.id = r."mapData"
        WHERE r."deletedAt" IS NULL
          AND r."mapData" IS NOT NULL
          AND ($1::boolean = false OR (m.kml IS NOT NULL OR m.gpx IS NOT NULL))
          AND ($2::uuid[] IS NULL OR m.id = ANY($2::uuid[]))
    `;
    const { rows } = await client.query<RopewikiMapDataReprocessTarget>(sql, [
        onlyWithStoredKmlOrGpx,
        includeMapDataIds ?? null,
    ]);
    return rows;
}
