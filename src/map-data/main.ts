import { PoolClient } from 'pg';
import getSourceFileUrl from './util/getSourceFileUrl';
import { processMapData } from './processors/processMapData';
import upsertMapData from './database/upsertMapData';
import replaceMapDataLegendItems from './database/replaceMapDataLegendItems';
import upsertPageRoute from './util/upsertPageRoute';
import { upsertRelevanceContextJob } from './database/upsertRelevanceContextJob';
import { PageRoute } from '../types/pageRoute';
import type { SaveMapDataHookFn } from './hook-functions/saveMapData';
import { MapDataEvent } from './types/mapDataEvent';
import { ProgressLogger } from 'ropegeo-common/helpers';

/**
 * Processes map data by reading source file URL from the database, downloading it (or fetching from S3 when downloadSource is false),
 * converting to GeoJSON, then to MBTiles, and saving via the provided hook function.
 *
 * @param mapDataEvent - The map data event containing source, routeId, pageId, optional mapDataId, downloadSource, cleanOutlierPoints, and processRelevantContext
 * @param saveMapDataHookFn - Hook function to persist produced files and return URLs
 * @param logger - Progress logger for tracking processing progress
 * @param client - Database client to use (must be provided)
 * @param abortSignal - Optional AbortSignal; when aborted during processing, the download or save hook is cancelled (processMapData throws). If aborted after processMapData returns, we still upsert.
 * @returns Promise that resolves when processing is complete
 */
export const main = async (
    mapDataEvent: MapDataEvent,
    saveMapDataHookFn: SaveMapDataHookFn,
    logger: ProgressLogger,
    client: PoolClient,
    abortSignal?: AbortSignal,
): Promise<void> => {
    const pageRoute: PageRoute = PageRoute.fromMapDataEvent(mapDataEvent);

    const sourceFileUrl = await getSourceFileUrl(client, mapDataEvent.source, mapDataEvent.pageId);

    if (!sourceFileUrl) {
        logger.logError(`No source file URL for route ${mapDataEvent.routeId} / page ${mapDataEvent.pageId}`);
        return;
    }

    const { mapData, legend } = await processMapData(
        sourceFileUrl,
        saveMapDataHookFn,
        pageRoute.mapData,
        logger,
        abortSignal,
        mapDataEvent.downloadSource,
        mapDataEvent.cleanOutlierPoints,
    );

    const { mapData: upsertedMapData, applied } = await upsertMapData(client, mapData);

    if (applied && upsertedMapData.id != null) {
        await replaceMapDataLegendItems(client, upsertedMapData.id, legend);
        if (mapDataEvent.processRelevantContext) {
            await upsertRelevanceContextJob(client, {
                mapDataId: upsertedMapData.id,
                pageId: mapDataEvent.pageId,
                pageSource: mapDataEvent.source,
            });
        }
    }

    pageRoute.mapData = upsertedMapData.id;
    await upsertPageRoute(client, mapDataEvent.source, pageRoute);
};
