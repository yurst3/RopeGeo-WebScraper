import type { PoolClient } from 'pg';

export type RelevanceReprocessTarget = {
    pageId: string;
    mapDataId: string;
};

/**
 * One preferred (pageId, mapDataId) pair per Ropewiki page that has MapData with at least
 * one legend item. Preference matches getMapDataIdForRopewikiPage: most legend items, then
 * earliest route createdAt.
 * When `includeMapDataIds` is set, only those MapData ids are considered.
 */
export async function listRelevanceReprocessTargets(
    client: PoolClient,
    includeMapDataIds?: string[],
): Promise<RelevanceReprocessTarget[]> {
    const sql = `
        SELECT DISTINCT ON (rr."ropewikiPage")
               rr."ropewikiPage"::text AS "pageId",
               m.id::text AS "mapDataId"
        FROM "RopewikiRoute" rr
        INNER JOIN "MapData" m ON m.id = rr."mapData" AND m."deletedAt" IS NULL
        WHERE rr."deletedAt" IS NULL
          AND rr."mapData" IS NOT NULL
          AND ($1::uuid[] IS NULL OR m.id = ANY($1::uuid[]))
          AND (
            EXISTS (SELECT 1 FROM "MapDataMarkerLegendItem" WHERE "mapData" = m.id)
            OR EXISTS (SELECT 1 FROM "MapDataSegmentLegendItem" WHERE "mapData" = m.id)
            OR EXISTS (SELECT 1 FROM "MapDataPolygonLegendItem" WHERE "mapData" = m.id)
          )
        ORDER BY rr."ropewikiPage",
          (
            (SELECT COUNT(*) FROM "MapDataMarkerLegendItem" WHERE "mapData" = m.id)
            + (SELECT COUNT(*) FROM "MapDataSegmentLegendItem" WHERE "mapData" = m.id)
            + (SELECT COUNT(*) FROM "MapDataPolygonLegendItem" WHERE "mapData" = m.id)
          ) DESC,
          rr."createdAt" ASC NULLS LAST
    `;
    const { rows } = await client.query<RelevanceReprocessTarget>(sql, [
        includeMapDataIds ?? null,
    ]);
    return rows;
}
