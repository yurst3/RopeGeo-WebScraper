import * as db from 'zapatos/db';
import { RopewikiRoute } from '../../types/pageRoute';
import { Route } from 'ropegeo-common';
import RopewikiPage from '../types/page';

/**
 * Upserts multiple RopewikiRoute records from route/page tuples.
 * On conflict (same route and ropewikiPage), updates mapData and timestamps.
 * 
 * @param conn - Database connection
 * @param routesAndPages - Array of [Route, RopewikiPage] tuples
 * @returns Promise that resolves to an array of RopewikiRoute objects
 */
const upsertRopewikiRoutes = async (
    conn: db.Queryable,
    routesAndPages: Array<[Route, RopewikiPage]>,
): Promise<RopewikiRoute[]> => {
    if (routesAndPages.length === 0) {
        return [];
    }

    // Convert tuples to RopewikiRoute objects using fromTuple
    const ropewikiRoutes = routesAndPages.map(RopewikiRoute.fromTuple);

    // Convert to database rows
    const rows = ropewikiRoutes.map(route => route.toDbRow());

    // Bulk upsert
    const result = await db
        .upsert('RopewikiRoute', rows, ['route', 'ropewikiPage'], {
            updateColumns: ['updatedAt', 'deletedAt'],
        })
        .run(conn);

    return result.map(RopewikiRoute.fromDbRow);
};

export default upsertRopewikiRoutes;
