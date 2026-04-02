import { Route, RouteType, type DifficultyParams } from 'ropegeo-common/classes';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { routeFromDbRow } from '../../../converters/route';
import { sqlAcaDifficultyOnPage } from '../../shared/acaPageDifficultySql';

export type RouteListFilters = {
    routeType: RouteType | null;
    difficulty: DifficultyParams | null;
};

/**
 * Fetches non-deleted routes from the Route table, converted to Route instances.
 * When `filters` includes an active route type and/or ACA difficulty, restricts to matching rows
 * (difficulty requires a linked RopewikiPage via RopewikiRoute).
 */
const getAllRoutes = async (
    conn: db.Queryable,
    filters?: RouteListFilters | null,
): Promise<Route[]> => {
    const routeType = filters?.routeType ?? null;
    const diff =
        filters?.difficulty != null && filters.difficulty.isActive()
            ? filters.difficulty
            : null;

    if (routeType === null && diff === null) {
        const rows = await db
            .select('Route', { deletedAt: db.conditions.isNull })
            .run(conn);
        return rows.map((row: s.Route.JSONSelectable) => routeFromDbRow(row));
    }

    const diffSql = sqlAcaDifficultyOnPage(diff);
    const routeTypeCond =
        routeType === null ? db.sql`TRUE` : db.sql`r.type = ${db.param(routeType)}`;
    const diffCond =
        diff === null
            ? db.sql`TRUE`
            : db.sql`EXISTS (
                SELECT 1 FROM "RopewikiRoute" rr
                INNER JOIN "RopewikiPage" p ON p.id = rr."ropewikiPage" AND p."deletedAt" IS NULL
                WHERE rr.route = r.id AND rr."deletedAt" IS NULL
                ${diffSql}
              )`;

    const rows = await db.sql<db.SQL, s.Route.JSONSelectable[]>`
        SELECT r.id, r.name, r.type, r.coordinates, r."createdAt", r."updatedAt", r."deletedAt", r."allowUpdates"
        FROM "Route" r
        WHERE r."deletedAt" IS NULL
          AND ${routeTypeCond}
          AND ${diffCond}
    `.run(conn);
    return rows.map((row) => routeFromDbRow(row));
};

export default getAllRoutes;
