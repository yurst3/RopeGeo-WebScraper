import type { PoolClient } from 'pg';
import { PageDataSource, Route, RoutesParams } from 'ropegeo-common';
import getAllRoutes from '../database/getAllRoutes';
import getRopewikiRegionRoutes from '../database/getRopewikiRegionRoutes';

/**
 * Returns routes based on params. When params.region is set and source is Ropewiki,
 * returns only routes for that region and its descendants; otherwise returns all non-deleted routes.
 */
const getRoutes = async (
    client: PoolClient,
    params: RoutesParams,
): Promise<Route[]> => {
    if (
        params.region !== null &&
        params.region.source === PageDataSource.Ropewiki
    ) {
        return getRopewikiRegionRoutes(client, params.region.id);
    }
    return getAllRoutes(client);
};

export default getRoutes;
