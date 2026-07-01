import * as db from 'zapatos/db';
import { MiniMapType, OnlineCenteredRegionMiniMap, OnlinePageMiniMap, OnlinePageView, PageDataSource, RoutesParams } from 'ropegeo-common/models';
import { getRopewikiRegionRouteStats } from '../../../api/getRoutes/database/getRopewikiRegionRoutes';
import listAllPbfKeysAndTotalBytes from '../../../api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes';
import { getMapDataForFolderReadiness } from '../database/getMapDataForFolderReadiness';

async function isPageTypeMiniMapReady(
    conn: db.Queryable,
    view: OnlinePageView,
): Promise<boolean> {
    const miniMap = view.miniMap;
    if (miniMap == null || miniMap.miniMapType !== MiniMapType.Page) {
        return true;
    }

    const pageMiniMap = miniMap as OnlinePageMiniMap;
    const mapDataId = pageMiniMap.mapDataId;
    if (mapDataId == null) {
        return false;
    }

    const tileCount = pageMiniMap.tileCount;
    if (tileCount <= 0) {
        return true;
    }

    const mapData = await getMapDataForFolderReadiness(conn, mapDataId);
    if (mapData == null || mapData.errorMessage != null) {
        return false;
    }

    const { keys } = await listAllPbfKeysAndTotalBytes(mapDataId);
    const expected = mapData.tileCount ?? tileCount;
    return keys.length === expected;
}

async function isCenteredRegionMiniMapReady(
    conn: db.Queryable,
    regionId: string,
    routeCount: number,
): Promise<boolean> {
    if (routeCount <= 0) {
        return true;
    }

    const routesParams = new RoutesParams({
        region: { id: regionId, source: PageDataSource.Ropewiki },
    });
    const stats = await getRopewikiRegionRouteStats(conn, regionId, routesParams);
    return stats.routeCount >= routeCount;
}

/** Returns true when the page view's online minimap assets are ready for bundling. */
export async function isOnlineMiniMapReady(
    conn: db.Queryable,
    regionId: string,
    view: OnlinePageView,
): Promise<boolean> {
    const miniMap = view.miniMap;
    if (miniMap == null || miniMap.fetchType !== 'online') {
        return true;
    }

    if (miniMap.miniMapType === MiniMapType.Page) {
        return isPageTypeMiniMapReady(conn, view);
    }

    if (miniMap.miniMapType === MiniMapType.CenteredRegion) {
        return isCenteredRegionMiniMapReady(conn, regionId, (miniMap as OnlineCenteredRegionMiniMap).routeCount);
    }

    return true;
}
