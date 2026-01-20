import * as db from 'zapatos/db';
import { RopewikiRoute } from '../../types/pageRoute';

// Get a RopewikiRoute by route ID and page ID.
// Returns undefined if the route-page link is not found or is deleted.
const getRopewikiRoute = async (
    conn: db.Queryable,
    route: string,
    ropewikiPage: string,
): Promise<RopewikiRoute | undefined> => {
    const row = await db
        .selectOne('RopewikiRoute', {
            route,
            ropewikiPage,
            deletedAt: db.conditions.isNull,
        })
        .run(conn);

    if (!row) {
        return undefined;
    }

    return RopewikiRoute.fromDbRow(row);
};

export default getRopewikiRoute;
