import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { RopewikiRoute } from '../../types/pageRoute';
import { Route } from 'ropegeo-common/classes';
import RopewikiPage from '../types/page';
import { makeUnnestPart } from '../../helpers/makeUnnestPart';

/**
 * Upserts multiple RopewikiRoute records from route/page tuples.
 * Uses raw SQL INSERT ... ON CONFLICT DO UPDATE WHERE allowUpdates = true.
 * Returns only rows that were actually inserted or updated (locked rows are not returned), in input order.
 */
const upsertRopewikiRoutes = async (
    conn: db.Queryable,
    routesAndPages: Array<[Route, RopewikiPage]>,
): Promise<RopewikiRoute[]> => {
    if (routesAndPages.length === 0) return [];

    const rows = routesAndPages.map(([route, page]) => RopewikiRoute.fromTuple([route, page]).toDbRow());
    const columns = RopewikiRoute.getDbInsertColumns();
    const unnestPart = makeUnnestPart(RopewikiRoute, rows);

    const key = (route: string, ropewikiPage: string) => `${route}\0${ropewikiPage}`;
    const returned = await db.sql<
        db.SQL,
        (s.RopewikiRoute.JSONSelectable)[]
    >`
        INSERT INTO "RopewikiRoute" ( ${db.cols(columns)} )
        SELECT * FROM unnest( ${unnestPart} ) AS t( ${db.cols(columns)} )
        ON CONFLICT ("route", "ropewikiPage") DO UPDATE SET
            "mapData" = COALESCE(EXCLUDED."mapData", "RopewikiRoute"."mapData"),
            "updatedAt" = EXCLUDED."updatedAt",
            "deletedAt" = EXCLUDED."deletedAt"
        WHERE "RopewikiRoute"."allowUpdates" = true
        RETURNING *
    `.run(conn);

    const byKey = new Map(returned.map((row) => [key(row.route, row.ropewikiPage), row]));
    return rows
        .filter((r) => byKey.has(key(r.route as string, r.ropewikiPage as string)))
        .map((r) => RopewikiRoute.fromDbRow(byKey.get(key(r.route as string, r.ropewikiPage as string))!));
};

export default upsertRopewikiRoutes;
