import { Route } from 'ropegeo-common';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { routeFromDbRow } from '../../../converters/route';
import getAllowedRegionIds from '../../../ropewiki/database/getAllowedRegionIds';

/**
 * Fetches routes linked to Ropewiki pages in the given region and all regions that are descendants of it.
 * Uses getAllowedRegionIds to resolve the region plus its descendant tree, then returns routes for pages in any of those regions.
 * Returns Route instances; empty array if the region (and descendants) have no linked routes.
 */
const getRopewikiRegionRoutes = async (
    conn: db.Queryable,
    regionUuid: string,
): Promise<Route[]> => {
    const allowedRegionIds = await getAllowedRegionIds(conn, regionUuid);
    if (allowedRegionIds.length === 0) {
        return [];
    }
    const rows = await db.sql<db.SQL, s.Route.JSONSelectable[]>`
        SELECT r.id, r.name, r.type, r.coordinates, r."createdAt", r."updatedAt", r."deletedAt", r."allowUpdates"
        FROM "Route" r
        INNER JOIN "RopewikiRoute" rr ON rr.route = r.id AND rr."deletedAt" IS NULL
        INNER JOIN "RopewikiPage" p ON p.id = rr."ropewikiPage" AND p."deletedAt" IS NULL
        WHERE r."deletedAt" IS NULL
          AND p.region = ANY(${db.param(allowedRegionIds)}::uuid[])
    `.run(conn);
    return rows.map((row) => routeFromDbRow(row));
};

export default getRopewikiRegionRoutes;
