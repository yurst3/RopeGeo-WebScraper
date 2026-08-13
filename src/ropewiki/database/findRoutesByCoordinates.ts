import * as db from 'zapatos/db';
import { Route, RouteType } from 'ropegeo-common/models';
import { coordinatesKey } from '../util/pagePopularity';

type ResultRow = {
    id: string;
    name: string;
    type: string;
    coordinates: { lat: number; lon: number };
};

/**
 * Finds non-deleted routes whose coordinates exactly match any of the given points.
 * When multiple routes share the same coordinates (legacy duplicates), the oldest
 * by createdAt is returned so callers keep a stable existing route.
 *
 * @returns Map from {@link coordinatesKey} to Route
 */
const findRoutesByCoordinates = async (
    conn: db.Queryable,
    coordinatesList: Array<{ lat: number; lon: number }>,
): Promise<Map<string, Route>> => {
    const byKey = new Map<string, Route>();

    if (coordinatesList.length === 0) {
        return byKey;
    }

    const uniqueCoords = new Map<string, { lat: number; lon: number }>();
    for (const coords of coordinatesList) {
        uniqueCoords.set(coordinatesKey(coords), coords);
    }
    const coordsArray = Array.from(uniqueCoords.values());
    const lats = coordsArray.map((c) => c.lat);
    const lons = coordsArray.map((c) => c.lon);

    const rows = await db.sql<db.SQL, Array<ResultRow>>`
        SELECT DISTINCT ON ((r.coordinates->>'lat'), (r.coordinates->>'lon'))
            r.id,
            r.name,
            r.type,
            r.coordinates
        FROM "Route" r
        WHERE r."deletedAt" IS NULL
          AND EXISTS (
            SELECT 1
            FROM unnest(
                ${db.param(lats)}::double precision[],
                ${db.param(lons)}::double precision[]
            ) AS t(lat, lon)
            WHERE (r.coordinates->>'lat')::double precision = t.lat
              AND (r.coordinates->>'lon')::double precision = t.lon
          )
        ORDER BY
            (r.coordinates->>'lat'),
            (r.coordinates->>'lon'),
            r."createdAt" ASC,
            r.id ASC
    `.run(conn);

    for (const row of rows) {
        const coords = row.coordinates;
        if (coords?.lat === undefined || coords?.lon === undefined) {
            continue;
        }
        byKey.set(
            coordinatesKey({ lat: Number(coords.lat), lon: Number(coords.lon) }),
            new Route(row.id, row.name, row.type as RouteType, {
                lat: Number(coords.lat),
                lon: Number(coords.lon),
            }),
        );
    }

    return byKey;
};

export default findRoutesByCoordinates;
