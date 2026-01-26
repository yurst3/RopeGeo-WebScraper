import { PoolClient } from 'pg';
import getSourceFileUrl from './util/getSourceFileUrl';
import { processMapData } from './processors/processMapData';
import upsertMapData from './database/upsertMapData';
import upsertPageRoute from './util/upsertPageRoute';
import { PageRoute } from '../types/pageRoute';
import type { SaveMapDataHookFn } from './hook-functions/saveMapData';
import { MapDataEvent } from './types/lambdaEvent';
import ProgressLogger from '../helpers/progressLogger';

/**
 * Processes map data by reading source file URL from the database, downloading it,
 * converting to GeoJSON, then to MBTiles, and saving via the provided hook function.
 * 
 * @param mapDataEvent - The map data event containing source, routeId, pageId, and optional mapDataId
 * @param saveMapDataHookFn - Hook function to persist produced files and return URLs
 * @param logger - Progress logger for tracking processing progress
 * @param client - Database client to use (must be provided)
 * @returns Promise that resolves when processing is complete
 */
export const main = async (
    mapDataEvent: MapDataEvent,
    saveMapDataHookFn: SaveMapDataHookFn,
    logger: ProgressLogger,
    client: PoolClient,
): Promise<void> => {
    // Create pageRoute from the event
    const pageRoute: PageRoute = PageRoute.fromMapDataEvent(mapDataEvent);

    // Get the source file URL
    const sourceFileUrl = await getSourceFileUrl(client, mapDataEvent.source, mapDataEvent.pageId);

    // If source file exists, process it and update the page route it belongs to
    if (sourceFileUrl) {
        // Process the source file (download, convert, save via hook)
        const mapData = await processMapData(sourceFileUrl, saveMapDataHookFn, pageRoute.mapData, logger);

        // Upsert the MapData object to the database
        const upsertedMapData = await upsertMapData(client, mapData);

        // Upsert the page-route with the new map data id
        pageRoute.mapData = upsertedMapData.id;
        await upsertPageRoute(client, mapDataEvent.source, pageRoute);
    }
};