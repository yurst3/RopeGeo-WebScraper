import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { Route } from 'ropegeo-common/models';
import { routeFromDbRow } from '../../../converters/route';
import { routeDisplayName } from '../util/routeDisplayName';

export type RouteRowWithLinkedPageCount = s.Route.JSONSelectable & {
    linkedPageCount: string | number;
};

/**
 * Correlated subquery: count of non-deleted Ropewiki pages linked to route alias `r`.
 */
export function sqlLinkedPageCountForRouteR(): db.SQLFragment {
    return db.sql`
        (
            SELECT COUNT(*)::int
            FROM "RopewikiRoute" rr_pc
            INNER JOIN "RopewikiPage" p_pc
                ON p_pc.id = rr_pc."ropewikiPage" AND p_pc."deletedAt" IS NULL
            WHERE rr_pc.route = r.id AND rr_pc."deletedAt" IS NULL
        )
    `;
}

/** Builds a Route whose display name includes `(+n)` when multiple pages are linked. */
export function routeFromDbRowWithLinkedPages(row: RouteRowWithLinkedPageCount): Route {
    const base = routeFromDbRow(row);
    const linkedPageCount =
        typeof row.linkedPageCount === 'number'
            ? row.linkedPageCount
            : parseInt(String(row.linkedPageCount), 10) || 0;
    return new Route(
        base.id,
        routeDisplayName(base.name, linkedPageCount),
        base.type,
        base.coordinates,
    );
}
