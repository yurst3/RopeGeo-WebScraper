import * as db from 'zapatos/db';

type MapDataRouteRow = {
    mapDataId: string;
};

/**
 * Resolves the preferred MapData id for a Ropewiki page: routes with the most legend
 * items win, then earliest createdAt.
 */
const getMapDataIdForRopewikiPage = async (
    conn: db.Queryable,
    pageId: string,
): Promise<string | null> => {
    const routeRows = await db.sql<db.SQL, MapDataRouteRow[]>`
        SELECT m.id AS "mapDataId"
        FROM "RopewikiRoute" rr
        INNER JOIN "Route" r ON r.id = rr.route AND r."deletedAt" IS NULL
        INNER JOIN "MapData" m ON m.id = rr."mapData"
        WHERE rr."ropewikiPage" = ${db.param(pageId)}::uuid
          AND rr."deletedAt" IS NULL
        ORDER BY (
            (SELECT COUNT(*) FROM "MapDataMarkerLegendItem" WHERE "mapData" = m.id)
            + (SELECT COUNT(*) FROM "MapDataSegmentLegendItem" WHERE "mapData" = m.id)
            + (SELECT COUNT(*) FROM "MapDataPolygonLegendItem" WHERE "mapData" = m.id)
        ) DESC,
        rr."createdAt" ASC NULLS LAST
        LIMIT 1
    `.run(conn);

    return routeRows[0]?.mapDataId ?? null;
};

export default getMapDataIdForRopewikiPage;
