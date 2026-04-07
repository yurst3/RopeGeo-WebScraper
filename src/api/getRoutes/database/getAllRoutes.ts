import { Route, RouteType, type DifficultyParams } from 'ropegeo-common/models';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { routeFromDbRow } from '../../../converters/route';
import { sqlAcaDifficultyOnPage } from '../../shared/acaPageDifficultySql';

export type RouteListFilters = {
    routeType: RouteType | null;
    difficulty: DifficultyParams | null;
};

/**
 * Counts non-deleted routes matching optional route-type and ACA difficulty filters.
 */
export async function countAllRoutes(
    conn: db.Queryable,
    filters?: RouteListFilters | null,
): Promise<number> {
    const routeType = filters?.routeType ?? null;
    const diff =
        filters?.difficulty != null && filters.difficulty.isActive()
            ? filters.difficulty
            : null;

    if (routeType === null && diff === null) {
        const rows = await db.sql<db.SQL, { c: string }[]>`
            SELECT COUNT(*)::text AS c FROM "Route" WHERE "deletedAt" IS NULL
        `.run(conn);
        return parseInt(rows[0]!.c, 10);
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

    const rows = await db.sql<db.SQL, { c: string }[]>`
        SELECT COUNT(*)::text AS c
        FROM "Route" r
        WHERE r."deletedAt" IS NULL
          AND ${routeTypeCond}
          AND ${diffCond}
    `.run(conn);
    return parseInt(rows[0]!.c, 10);
}

/**
 * Fetches one page of non-deleted routes, ordered by `id`, with optional filters.
 */
export async function getAllRoutesPage(
    conn: db.Queryable,
    filters: RouteListFilters | null | undefined,
    limit: number,
    offset: number,
): Promise<Route[]> {
    const routeType = filters?.routeType ?? null;
    const diff =
        filters?.difficulty != null && filters.difficulty.isActive()
            ? filters.difficulty
            : null;

    if (routeType === null && diff === null) {
        const rows = await db.sql<db.SQL, s.Route.JSONSelectable[]>`
            SELECT r.id, r.name, r.type, r.coordinates, r."createdAt", r."updatedAt", r."deletedAt", r."allowUpdates"
            FROM "Route" r
            WHERE r."deletedAt" IS NULL
            ORDER BY r.id ASC
            LIMIT ${db.param(limit)} OFFSET ${db.param(offset)}
        `.run(conn);
        return rows.map((row) => routeFromDbRow(row));
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
        ORDER BY r.id ASC
        LIMIT ${db.param(limit)} OFFSET ${db.param(offset)}
    `.run(conn);
    return rows.map((row) => routeFromDbRow(row));
}
