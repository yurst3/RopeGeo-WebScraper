import * as db from 'zapatos/db';
import { RopewikiRoute } from '../../types/pageRoute';

// Insert or update a RopewikiRoute record.
// On conflict (same route and ropewikiPage), update mapData and timestamps.
// Returns void.
const upsertRopewikiRoute = async (
    conn: db.Queryable,
    ropewikiRoute: RopewikiRoute,
): Promise<void> => {
    const row = ropewikiRoute.toDbRow();

    await db
        .upsert('RopewikiRoute', [row], ['route', 'ropewikiPage'], {
            updateColumns: ['mapData', 'updatedAt', 'deletedAt'],
        })
        .run(conn);
};

export default upsertRopewikiRoute;
