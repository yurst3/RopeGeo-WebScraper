import getDatabaseConnection from '../helpers/getDatabaseConnection';
import { PageDataSource } from '../types/pageRoute';
import getSourceFileUrl from './util/getSourceFileUrl';
import { processMapData } from './processors/processMapData';
import upsertMapData from './database/upsertMapData';
import upsertPageRoute from './util/upsertPageRoute';
import { PageRoute } from '../types/pageRoute';
import type { SaveMapDataHookFn } from './hook-functions/saveMapData';
import { nodeSaveMapData } from './hook-functions/saveMapData';
import { MapDataEvent } from './types/lambdaEvent';

/**
 * Processes map data by reading source file URL from the database, downloading it,
 * converting to GeoJSON, then to MBTiles, and saving via the provided hook function.
 * 
 * @param saveMapDataHookFn - Hook function to persist produced files and return URLs
 * @param mapDataEvent - The map data event containing source, routeId, pageId, and optional mapDataId
 * @returns Promise that resolves when processing is complete
 */
export const main = async (
    saveMapDataHookFn: SaveMapDataHookFn,
    mapDataEvent: MapDataEvent,
): Promise<void> => {
    const pool = await getDatabaseConnection();
    const client = await pool.connect();

    try {
        // Create pageRoute from the event
        const pageRoute: PageRoute = PageRoute.fromMapDataEvent(mapDataEvent);

        // Get the source file URL
        const sourceFileUrl = await getSourceFileUrl(client, mapDataEvent.source, mapDataEvent.pageId);

        // If source file exists, process it and update the page route it belongs to
        if (sourceFileUrl) {
            // Process the source file (download, convert, save via hook)
            const mapData = await processMapData(sourceFileUrl, saveMapDataHookFn, pageRoute.mapData);

            // Upsert the MapData object to the database
            const upsertedMapData = await upsertMapData(client, mapData);

            // Upsert the page-route with the new map data id
            pageRoute.mapData = upsertedMapData.id;
            await upsertPageRoute(client, mapDataEvent.source, pageRoute);
        }
    } finally {
        client.release();
        await pool.end();
    }
};

// Use the node hook functions which will save files locally
const saveMapDataHookFn = nodeSaveMapData;

// Allow running as a Node.js script (not just Lambda handler)
if (require.main === module) {
    const pageDataSourceArg = process.argv[2];
    const pageId = process.argv[3];
    const routeId = process.argv[4];
    const mapDataId = process.argv[5];

    if (!pageDataSourceArg || !pageId || !routeId) {
        console.error('Usage: node src/map-data/main.ts <pageDataSource> <pageId> <routeId> [mapDataId]');
        process.exit(1);
    }

    // Convert string argument to enum value
    const pageDataSource = pageDataSourceArg as PageDataSource;
    if (!Object.values(PageDataSource).includes(pageDataSource)) {
        console.error(`Invalid pageDataSource: ${pageDataSourceArg}. Must be one of: ${Object.values(PageDataSource).join(', ')}`);
        process.exit(1);
    }

    const mapDataEvent = new MapDataEvent(pageDataSource, routeId, pageId, mapDataId);

    main(saveMapDataHookFn, mapDataEvent)
        .then(() => {
            console.log('Map data processing complete.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}