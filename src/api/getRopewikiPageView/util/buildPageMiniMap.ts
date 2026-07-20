import type { Queryable } from 'zapatos/db';
import type * as s from 'zapatos/schema';
import {
    Bounds,
    OnlineCenteredRegionMiniMap,
    OnlinePageMiniMap,
    PageDataSource,
    RoutesParams,
} from 'ropegeo-common/models';
import {
    PAGE_MINIMAP_POINT_LAYER_ID,
    PAGE_MINIMAP_POLYLINE_LAYER_ID,
} from '../../../constants/pageMinimapMvtLayerIds';
import { getRopewikiRegionRouteStats } from '../../getRoutes/database/getRopewikiRegionRoutes';
import { loadPageLegend } from './loadPageLegend';
import {
    normalizeTilesTemplateAndBounds,
    parseMapDataBounds,
    resolveRouteMapDataId,
} from './mapDataMiniMapFields';

export type RouteMapRow = {
    routeId: string;
    routeName: string;
    routeType: string;
    mapDataId: string | null;
    tilesTemplate: string | null;
    tileCount: number;
    tileTotalBytes: string | number;
    bounds: { north: number; south: number; east: number; west: number } | null;
    mapAuthors: string[] | null;
};

type BetaSectionRow = Pick<
    s.RopewikiBetaSection.JSONSelectable,
    'id' | 'order' | 'title' | 'text' | 'latestRevisionDate'
>;

async function buildPageVectorMiniMap(
    conn: Queryable,
    routeRow: RouteMapRow,
    mapDataId: string,
    tilesTemplate: string,
    bounds: { north: number; south: number; east: number; west: number },
    title: string,
    betaSections: BetaSectionRow[],
): Promise<OnlinePageMiniMap> {
    const pageLegend = await loadPageLegend(conn, mapDataId, betaSections);
    return new OnlinePageMiniMap(
        PAGE_MINIMAP_POLYLINE_LAYER_ID,
        PAGE_MINIMAP_POINT_LAYER_ID,
        tilesTemplate,
        new Bounds(bounds.north, bounds.south, bounds.east, bounds.west),
        title,
        routeRow.tileCount ?? 0,
        Number(routeRow.tileTotalBytes ?? 0),
        mapDataId,
        pageLegend,
        routeRow.mapAuthors ?? null,
    );
}

async function buildCenteredRegionMiniMap(
    conn: Queryable,
    regionId: string,
    routeId: string,
    title: string,
): Promise<OnlineCenteredRegionMiniMap> {
    const routesParams = new RoutesParams({
        region: { id: regionId, source: PageDataSource.Ropewiki },
    });
    const routeStats = await getRopewikiRegionRouteStats(conn, regionId, routesParams);
    return new OnlineCenteredRegionMiniMap(
        routesParams,
        routeId,
        title,
        routeStats.routeCount,
        routeStats.totalBytes,
    );
}

/**
 * Builds the page view minimap from the joined route/MapData row.
 * Prefers a vector page minimap when tiles + bounds are present; otherwise a centered region minimap.
 */
export async function buildPageMiniMap(
    conn: Queryable,
    page: Pick<s.RopewikiPage.Selectable, 'name' | 'region'>,
    routeRow: RouteMapRow | undefined,
    betaSections: BetaSectionRow[],
): Promise<OnlinePageMiniMap | OnlineCenteredRegionMiniMap | null> {
    if (routeRow == null) {
        return null;
    }

    const title = (() => {
        const routeName = routeRow.routeName?.trim() ?? '';
        return routeName.length > 0 ? routeName : page.name;
    })();

    const { tilesTemplate, bounds } = normalizeTilesTemplateAndBounds(
        routeRow.tilesTemplate ?? null,
        parseMapDataBounds(routeRow.bounds),
    );
    const mapDataId = resolveRouteMapDataId(routeRow.mapDataId);

    if (mapDataId != null && tilesTemplate != null && bounds != null) {
        return buildPageVectorMiniMap(
            conn,
            routeRow,
            mapDataId,
            tilesTemplate,
            bounds,
            title,
            betaSections,
        );
    }

    return buildCenteredRegionMiniMap(conn, page.region, routeRow.routeId, title);
}
