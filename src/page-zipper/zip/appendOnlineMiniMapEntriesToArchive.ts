import type { Archiver } from 'archiver';
import type { PoolClient } from 'pg';
import { MiniMapType, OnlineCenteredRegionMiniMap, OnlinePageMiniMap, OnlinePageView } from 'ropegeo-common/models';
import { regionRoutesGeojsonRelativePath } from 'ropegeo-common/helpers';
import { appendTileEntriesToArchive } from './appendTileEntriesToArchive';
import { buildRegionRoutesGeoJson } from './buildRegionRoutesGeoJson';
import { getMapDataBucketName } from '../util/folderBuildEnv';

async function appendPageTypeMiniMapEntries(
    archive: Archiver,
    mapDataId: string | null,
    tileCount: number,
): Promise<void> {
    if (mapDataId == null || tileCount <= 0) {
        return;
    }

    await appendTileEntriesToArchive(archive, getMapDataBucketName(), mapDataId);
}

async function appendCenteredRegionMiniMapEntries(
    archive: Archiver,
    conn: PoolClient,
    regionId: string,
    routeCount: number,
): Promise<void> {
    if (routeCount <= 0) {
        return;
    }

    const geojson = await buildRegionRoutesGeoJson(conn, regionId);
    archive.append(geojson, {
        name: regionRoutesGeojsonRelativePath(regionId),
    });
}

/** Adds online minimap assets (tiles or region routes) to the download ZIP. */
export async function appendOnlineMiniMapEntriesToArchive(
    archive: Archiver,
    conn: PoolClient,
    regionId: string,
    view: OnlinePageView,
): Promise<void> {
    const miniMap = view.miniMap;
    if (miniMap == null || miniMap.fetchType !== 'online') {
        return;
    }

    if (miniMap.miniMapType === MiniMapType.Page) {
        const pageMiniMap = miniMap as OnlinePageMiniMap;
        await appendPageTypeMiniMapEntries(archive, pageMiniMap.mapDataId, pageMiniMap.tileCount);
        return;
    }

    if (miniMap.miniMapType === MiniMapType.CenteredRegion) {
        const centeredMiniMap = miniMap as OnlineCenteredRegionMiniMap;
        await appendCenteredRegionMiniMapEntries(archive, conn, regionId, centeredMiniMap.routeCount);
    }
}
