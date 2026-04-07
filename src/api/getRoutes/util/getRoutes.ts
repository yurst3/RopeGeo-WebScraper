import type { PoolClient } from 'pg';
import { PageDataSource, Route, RoutesParams } from 'ropegeo-common/models';
import {
    countAllRoutes,
    getAllRoutesPage,
} from '../database/getAllRoutes';
import {
    countRopewikiRegionRoutes,
    getRopewikiRegionRoutesPage,
} from '../database/getRopewikiRegionRoutes';

export type GetRoutesPageResult = {
    routes: Route[];
    total: number;
};

/**
 * Returns one page of routes for GET /routes: global list or region subtree (ropewiki pages),
 * with optional route-type and ACA difficulty filters. Source allow-list: empty/absent means all;
 * if set and excludes ropewiki, returns `{ routes: [], total: 0 }` for region-scoped queries.
 */
const getRoutes = async (
    client: PoolClient,
    params: RoutesParams,
): Promise<GetRoutesPageResult> => {
    const filters = {
        routeType: params.routeType,
        difficulty: params.difficulty,
    };

    const limit = params.limit;
    const offset = (params.page - 1) * limit;

    if (params.region === null) {
        const total = await countAllRoutes(client, filters);
        const routes = await getAllRoutesPage(client, filters, limit, offset);
        return { routes, total };
    }

    const { id, source } = params.region;
    if (
        source !== null &&
        source.length > 0 &&
        !source.includes(PageDataSource.Ropewiki)
    ) {
        return { routes: [], total: 0 };
    }

    const total = await countRopewikiRegionRoutes(client, id, filters);
    const routes = await getRopewikiRegionRoutesPage(client, id, filters, limit, offset);
    return { routes, total };
};

export default getRoutes;
