import type { PoolClient } from 'pg';
import { PageDataSource, Route, RoutesParams } from 'ropegeo-common/classes';
import getAllRoutes from '../database/getAllRoutes';
import getRopewikiRegionRoutes from '../database/getRopewikiRegionRoutes';

/**
 * Returns routes for GET /routes: global list or region subtree (ropewiki pages), with optional
 * route-type and ACA difficulty filters. Source allow-list: empty/absent means all; if set and
 * excludes ropewiki, no routes are returned for region-scoped queries (only ropewiki-backed routes exist).
 */
const getRoutes = async (client: PoolClient, params: RoutesParams): Promise<Route[]> => {
    const filters = {
        routeType: params.routeType,
        difficulty: params.difficulty,
    };

    if (params.region === null) {
        return getAllRoutes(client, filters);
    }

    const { id, source } = params.region;
    if (
        source !== null &&
        source.length > 0 &&
        !source.includes(PageDataSource.Ropewiki)
    ) {
        return [];
    }

    return getRopewikiRegionRoutes(client, id, filters);
};

export default getRoutes;
