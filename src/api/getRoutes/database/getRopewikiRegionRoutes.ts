import { Route } from 'ropegeo-common/classes';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { routeFromDbRow } from '../../../converters/route';
import getAllowedRegionIds from '../../../ropewiki/database/getAllowedRegionIds';
import { sqlAcaDifficultyOnPage } from '../../shared/acaPageDifficultySql';
import type { RouteListFilters } from './getAllRoutes';

/**
 * Fetches routes linked to Ropewiki pages in the given region and all regions that are descendants of it.
 * Optional filters: route type on Route row; ACA difficulty on linked page columns.
 */
const getRopewikiRegionRoutes = async (
    conn: db.Queryable,
    regionUuid: string,
    filters?: RouteListFilters | null,
): Promise<Route[]> => {
    const allowedRegionIds = await getAllowedRegionIds(conn, regionUuid);
    if (allowedRegionIds.length === 0) {
        return [];
    }

    const routeType = filters?.routeType ?? null;
    const diff =
        filters?.difficulty != null && filters.difficulty.isActive()
            ? filters.difficulty
            : null;
    const diffSql = sqlAcaDifficultyOnPage(diff);
    const routeTypeCond =
        routeType === null ? db.sql`TRUE` : db.sql`r.type = ${db.param(routeType)}`;

    const rows = await db.sql<db.SQL, s.Route.JSONSelectable[]>`
        SELECT r.id, r.name, r.type, r.coordinates, r."createdAt", r."updatedAt", r."deletedAt", r."allowUpdates"
        FROM "Route" r
        INNER JOIN "RopewikiRoute" rr ON rr.route = r.id AND rr."deletedAt" IS NULL
        INNER JOIN "RopewikiPage" p ON p.id = rr."ropewikiPage" AND p."deletedAt" IS NULL
        WHERE r."deletedAt" IS NULL
          AND p.region = ANY(${db.param(allowedRegionIds)}::uuid[])
          AND ${routeTypeCond}
          ${diffSql}
    `.run(conn);
    return rows.map((row) => routeFromDbRow(row));
};

export default getRopewikiRegionRoutes;
