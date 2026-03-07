import { Route } from 'ropegeo-common';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { routeFromDbRow } from '../../../converters/route';

/**
 * Fetches all non-deleted routes from the Route table, converted to Route instances.
 */
const getAllRoutes = async (conn: db.Queryable): Promise<Route[]> => {
    const rows = await db
        .select('Route', { deletedAt: db.conditions.isNull })
        .run(conn);
    return rows.map((row: s.Route.JSONSelectable) => routeFromDbRow(row));
};

export default getAllRoutes;
