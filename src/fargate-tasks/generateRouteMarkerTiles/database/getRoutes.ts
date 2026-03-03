import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';

/**
 * Fetches all non-deleted routes from the Route table.
 */
export const getRoutes = async (conn: db.Queryable): Promise<s.Route.JSONSelectable[]> => {
    return await db
        .select('Route', { deletedAt: db.conditions.isNull })
        .run(conn);
};
