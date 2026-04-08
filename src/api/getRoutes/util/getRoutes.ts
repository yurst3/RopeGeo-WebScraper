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
 * Returns one page of routes for GET /routes: global list (optional `sources` allow-list) or
 * region subtree (`region-id` + `region-source`), with optional route-types and ACA difficulty filters.
 * Region scope requires ropewiki catalogue; other catalogues return an empty page until supported.
 */
const getRoutes = async (
    client: PoolClient,
    params: RoutesParams,
): Promise<GetRoutesPageResult> => {
    const limit = params.limit;
    const offset = (params.page - 1) * limit;

    if (params.region === null) {
        const filters = {
            routeTypes: params.routeTypes,
            difficulty: params.difficulty,
            sources: params.sources,
        };
        const total = await countAllRoutes(client, filters);
        const routes = await getAllRoutesPage(client, filters, limit, offset);
        return { routes, total };
    }

    const { id, source } = params.region;
    if (source !== PageDataSource.Ropewiki) {
        return { routes: [], total: 0 };
    }

    const filters = {
        routeTypes: params.routeTypes,
        difficulty: params.difficulty,
        sources: null,
    };
    const total = await countRopewikiRegionRoutes(client, id, filters);
    const routes = await getRopewikiRegionRoutesPage(client, id, filters, limit, offset);
    return { routes, total };
};

export default getRoutes;
