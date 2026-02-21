import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import type { PageRoute } from '../../../types/pageRoute';
import RopewikiRoute from '../../../types/pageRoute';

/**
 * Returns all page routes (e.g. RopewikiRoute) linked to the given route id.
 * For now only selects from RopewikiRoute; additional route tables can be added later.
 */
const getPageRoutes = async (
    conn: db.Queryable,
    routeId: string,
): Promise<PageRoute[]> => {
    const rows = await db
        .select('RopewikiRoute', {
            route: routeId,
            deletedAt: db.conditions.isNull,
        })
        .run(conn);

    return rows.map((row: s.RopewikiRoute.JSONSelectable) =>
        RopewikiRoute.fromDbRow(row),
    );
};

export default getPageRoutes;
