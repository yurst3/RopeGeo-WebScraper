import type { PoolClient } from 'pg';
import { PageDataSource, Route, RoutesParams } from 'ropegeo-common/models';
import {
    countRopewikiRegionRoutes,
    getRopewikiRegionRoutesPage,
} from '../../../api/getRoutes/database/getRopewikiRegionRoutes';

const ROUTES_PAGE_SIZE = 500;

/** Builds merged routes GeoJSON for a centered-region minimap bundle entry. */
export async function buildRegionRoutesGeoJson(
    conn: PoolClient,
    regionId: string,
): Promise<string> {
    const routesParams = new RoutesParams({
        region: { id: regionId, source: PageDataSource.Ropewiki },
    });
    const total = await countRopewikiRegionRoutes(conn, regionId, routesParams);
    const features: unknown[] = [];

    for (let offset = 0; offset < total; offset += ROUTES_PAGE_SIZE) {
        const routes: Route[] = await getRopewikiRegionRoutesPage(
            conn,
            regionId,
            routesParams,
            ROUTES_PAGE_SIZE,
            offset,
        );
        for (const route of routes) {
            features.push(route.toGeoJsonFeature());
        }
    }

    return JSON.stringify({ type: 'FeatureCollection', features });
}
