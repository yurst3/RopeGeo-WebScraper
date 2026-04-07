import { Route } from 'ropegeo-common/models';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { routeFromDbRow } from '../../../converters/route';
import getAllowedRegionIds from '../../../ropewiki/database/getAllowedRegionIds';
import { sqlAcaDifficultyOnPage } from '../../shared/acaPageDifficultySql';
import type { RouteListFilters } from './getAllRoutes';

/**
 * Counts routes linked to Ropewiki pages in the region subtree matching optional filters.
 */
export async function countRopewikiRegionRoutes(
    conn: db.Queryable,
    regionUuid: string,
    filters?: RouteListFilters | null,
): Promise<number> {
    const allowedRegionIds = await getAllowedRegionIds(conn, regionUuid);
    if (allowedRegionIds.length === 0) {
        return 0;
    }

    const routeType = filters?.routeType ?? null;
    const diff =
        filters?.difficulty != null && filters.difficulty.isActive()
            ? filters.difficulty
            : null;
    const diffSql = sqlAcaDifficultyOnPage(diff);
    const routeTypeCond =
        routeType === null ? db.sql`TRUE` : db.sql`r.type = ${db.param(routeType)}`;

    const rows = await db.sql<db.SQL, { c: string }[]>`
        SELECT COUNT(*)::text AS c
        FROM "Route" r
        INNER JOIN "RopewikiRoute" rr ON rr.route = r.id AND rr."deletedAt" IS NULL
        INNER JOIN "RopewikiPage" p ON p.id = rr."ropewikiPage" AND p."deletedAt" IS NULL
        WHERE r."deletedAt" IS NULL
          AND p.region = ANY(${db.param(allowedRegionIds)}::uuid[])
          AND ${routeTypeCond}
          ${diffSql}
    `.run(conn);
    return parseInt(rows[0]!.c, 10);
}

/**
 * Fetches one page of routes in the region subtree, ordered by route id.
 */
export async function getRopewikiRegionRoutesPage(
    conn: db.Queryable,
    regionUuid: string,
    filters: RouteListFilters | null | undefined,
    limit: number,
    offset: number,
): Promise<Route[]> {
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
        ORDER BY r.id ASC
        LIMIT ${db.param(limit)} OFFSET ${db.param(offset)}
    `.run(conn);
    return rows.map((row) => routeFromDbRow(row));
}
