import {
    PageDataSource,
    Route,
    RouteType,
    type DifficultyParams,
} from 'ropegeo-common/models';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { routeFromDbRow } from '../../../converters/route';
import { sqlAcaDifficultyOnPage } from '../../shared/acaPageDifficultySql';

export type RouteListFilters = {
    routeTypes: RouteType[] | null;
    difficulty: DifficultyParams | null;
    /** Global allow-list only; omit / null / empty = any source. */
    sources?: PageDataSource[] | null;
};

function sqlSourceAllowList(
    sources: PageDataSource[] | null | undefined,
): db.SQLFragment {
    const list = sources ?? null;
    if (list === null || list.length === 0) {
        return db.sql`TRUE`;
    }
    if (!list.includes(PageDataSource.Ropewiki)) {
        return db.sql`FALSE`;
    }
    return db.sql`EXISTS (
        SELECT 1 FROM "RopewikiRoute" rr
        WHERE rr.route = r.id AND rr."deletedAt" IS NULL
    )`;
}

/**
 * Counts non-deleted routes matching optional route-type allow-list, ACA difficulty, and source allow-list.
 */
export async function countAllRoutes(
    conn: db.Queryable,
    filters?: RouteListFilters | null,
): Promise<number> {
    const routeTypes = filters?.routeTypes ?? null;
    const diff =
        filters?.difficulty != null && filters.difficulty.isActive()
            ? filters.difficulty
            : null;
    const sources = filters?.sources ?? null;

    const hasSourceFilter = sources !== null && sources.length > 0;

    if (
        (routeTypes === null || routeTypes.length === 0) &&
        diff === null &&
        !hasSourceFilter
    ) {
        const rows = await db.sql<db.SQL, { c: string }[]>`
            SELECT COUNT(*)::text AS c FROM "Route" WHERE "deletedAt" IS NULL
        `.run(conn);
        return parseInt(rows[0]!.c, 10);
    }

    const diffSql = sqlAcaDifficultyOnPage(diff);
    const routeTypeCond =
        routeTypes === null || routeTypes.length === 0
            ? db.sql`TRUE`
            : db.sql`r.type = ANY(${db.param(routeTypes)}::text[])`;
    const diffCond =
        diff === null
            ? db.sql`TRUE`
            : db.sql`EXISTS (
                SELECT 1 FROM "RopewikiRoute" rr
                INNER JOIN "RopewikiPage" p ON p.id = rr."ropewikiPage" AND p."deletedAt" IS NULL
                WHERE rr.route = r.id AND rr."deletedAt" IS NULL
                ${diffSql}
              )`;
    const sourceCond = sqlSourceAllowList(sources);

    const rows = await db.sql<db.SQL, { c: string }[]>`
        SELECT COUNT(*)::text AS c
        FROM "Route" r
        WHERE r."deletedAt" IS NULL
          AND ${routeTypeCond}
          AND ${diffCond}
          AND ${sourceCond}
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
    const routeTypes = filters?.routeTypes ?? null;
    const diff =
        filters?.difficulty != null && filters.difficulty.isActive()
            ? filters.difficulty
            : null;
    const sources = filters?.sources ?? null;

    const hasSourceFilter = sources !== null && sources.length > 0;

    if (
        (routeTypes === null || routeTypes.length === 0) &&
        diff === null &&
        !hasSourceFilter
    ) {
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
        routeTypes === null || routeTypes.length === 0
            ? db.sql`TRUE`
            : db.sql`r.type = ANY(${db.param(routeTypes)}::text[])`;
    const diffCond =
        diff === null
            ? db.sql`TRUE`
            : db.sql`EXISTS (
                SELECT 1 FROM "RopewikiRoute" rr
                INNER JOIN "RopewikiPage" p ON p.id = rr."ropewikiPage" AND p."deletedAt" IS NULL
                WHERE rr.route = r.id AND rr."deletedAt" IS NULL
                ${diffSql}
              )`;
    const sourceCond = sqlSourceAllowList(sources);

    const rows = await db.sql<db.SQL, s.Route.JSONSelectable[]>`
        SELECT r.id, r.name, r.type, r.coordinates, r."createdAt", r."updatedAt", r."deletedAt", r."allowUpdates"
        FROM "Route" r
        WHERE r."deletedAt" IS NULL
          AND ${routeTypeCond}
          AND ${diffCond}
          AND ${sourceCond}
        ORDER BY r.id ASC
        LIMIT ${db.param(limit)} OFFSET ${db.param(offset)}
    `.run(conn);
    return rows.map((row) => routeFromDbRow(row));
}
