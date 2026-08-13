import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';
import { Route } from 'ropegeo-common/models';
import findRoutesByCoordinates from '../database/findRoutesByCoordinates';
import { coordinatesKey } from './pagePopularity';

/**
 * For pages that do not already have a linked route, finds an existing Route with
 * the same coordinates (e.g. created for another Ropewiki page) and assigns it.
 * Pages that already have a route are left unchanged.
 */
const correlateExistingRoutes = async (
    conn: db.Queryable,
    routesAndPages: Array<[Route | null, RopewikiPage]>,
): Promise<Array<[Route | null, RopewikiPage]>> => {
    const pagesNeedingRoutes = routesAndPages
        .filter(([route]) => route === null)
        .map(([, page]) => page)
        .filter((page): page is RopewikiPage & { coordinates: { lat: number; lon: number } } =>
            page.coordinates !== undefined,
        );

    if (pagesNeedingRoutes.length === 0) {
        return routesAndPages;
    }

    const routesByCoords = await findRoutesByCoordinates(
        conn,
        pagesNeedingRoutes.map((page) => page.coordinates),
    );

    if (routesByCoords.size === 0) {
        return routesAndPages;
    }

    return routesAndPages.map(([route, page]) => {
        if (route !== null || !page.coordinates) {
            return [route, page];
        }
        const matched = routesByCoords.get(coordinatesKey(page.coordinates)) ?? null;
        return [matched, page];
    });
};

export default correlateExistingRoutes;
