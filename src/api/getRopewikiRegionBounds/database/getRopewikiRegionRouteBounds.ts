import { Bounds } from 'ropegeo-common/models';
import * as db from 'zapatos/db';
import getAllowedRegionIds from '../../../ropewiki/database/getAllowedRegionIds';

type ExtentRow = {
    n: string | null;
    s: string | null;
    e: string | null;
    w: string | null;
};

/**
 * Bounding box over {@link Route.coordinates} (lat/lon JSON) for all non-deleted routes linked to
 * ropewiki pages in the given region subtree. No route-type, difficulty, or source filters.
 * Returns null when there are no routes with usable coordinates in that subtree.
 */
const getRopewikiRegionRouteBounds = async (
    conn: db.Queryable,
    regionUuid: string,
): Promise<Bounds | null> => {
    const allowedRegionIds = await getAllowedRegionIds(conn, regionUuid);
    if (allowedRegionIds.length === 0) {
        return null;
    }

    const rows = await db.sql<db.SQL, ExtentRow[]>`
        SELECT
            MAX((r.coordinates->>'lat')::double precision)::text AS n,
            MIN((r.coordinates->>'lat')::double precision)::text AS s,
            MAX((r.coordinates->>'lon')::double precision)::text AS e,
            MIN((r.coordinates->>'lon')::double precision)::text AS w
        FROM "Route" r
        INNER JOIN "RopewikiRoute" rr ON rr.route = r.id AND rr."deletedAt" IS NULL
        INNER JOIN "RopewikiPage" p ON p.id = rr."ropewikiPage" AND p."deletedAt" IS NULL
        WHERE r."deletedAt" IS NULL
          AND p.region = ANY(${db.param(allowedRegionIds)}::uuid[])
          AND r.coordinates IS NOT NULL
          AND (r.coordinates->>'lat') IS NOT NULL
          AND (r.coordinates->>'lon') IS NOT NULL
    `.run(conn);

    const r = rows[0];
    if (
        r == null ||
        r.n == null ||
        r.s == null ||
        r.e == null ||
        r.w == null ||
        r.n === '' ||
        r.s === '' ||
        r.e === '' ||
        r.w === ''
    ) {
        return null;
    }

    const north = parseFloat(r.n);
    const south = parseFloat(r.s);
    const east = parseFloat(r.e);
    const west = parseFloat(r.w);
    if (
        Number.isNaN(north) ||
        Number.isNaN(south) ||
        Number.isNaN(east) ||
        Number.isNaN(west)
    ) {
        return null;
    }

    return new Bounds(north, south, east, west);
};

export default getRopewikiRegionRouteBounds;
