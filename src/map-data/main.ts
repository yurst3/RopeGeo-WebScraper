import getDatabaseConnection from '../helpers/getDatabaseConnection';
import { PageDataSource } from './types/mapData';
import getSourceFileUrl from './util/getSourceFileUrl';
import getPageRoute from './util/getPageRoute';
import { processMapData } from './processors/processMapData';
import upsertMapData from './database/upsertMapData';
import upsertPageRoute from './util/upsertPageRoute';
import { PageRoute } from '../types/pageRoute';
import type { SaveMapDataHookFn } from './hook-functions/saveMapData';
import { nodeSaveMapData } from './hook-functions/saveMapData';

/**
 * Processes map data by reading source file URL from the database, downloading it,
 * converting to GeoJSON, then to MBTiles, and saving via the provided hook function.
 * 
 * @param saveMapDataHookFn - Hook function to persist produced files and return URLs
 * @param pageDataSource - Source of the page data (e.g., PageDataSource.Ropewiki)
 * @param pageId - ID of the page
 * @param routeId - ID of the route
 * @returns Promise that resolves when processing is complete
 */
export const main = async (
    saveMapDataHookFn: SaveMapDataHookFn,
    pageDataSource: PageDataSource,
    pageId: string,
    routeId: string,
): Promise<void> => {
    const pool = await getDatabaseConnection();
    const client = await pool.connect();

    try {
        // Get existing pageRoute if there is one or make a new one
        const pageRoute: PageRoute = await getPageRoute(client, pageDataSource, pageId, routeId) ?? new PageRoute(routeId, pageId);

        // Get the source file URL
        const sourceFileUrl = await getSourceFileUrl(client, pageDataSource, pageId);

        // If source file exists, process it
        if (sourceFileUrl) {
            const mapDataId: string | undefined = pageRoute.mapData;

            // Process the source file (download, convert, save via hook)
            const mapData = await processMapData(sourceFileUrl, saveMapDataHookFn, mapDataId);

            // Upsert the MapData object to the database
            const upsertedMapData = await upsertMapData(client, mapData);
            pageRoute.mapData = upsertedMapData.id;
        }

        // Upsert the page-route link (regardless of whether map data was created)
        await upsertPageRoute(client, pageDataSource, pageRoute);
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

    if (!pageDataSourceArg || !pageId || !routeId) {
        console.error('Usage: node src/map-data/main.ts <pageDataSource> <pageId> <routeId>');
        process.exit(1);
    }

    // Convert string argument to enum value
    const pageDataSource = pageDataSourceArg as PageDataSource;
    if (!Object.values(PageDataSource).includes(pageDataSource)) {
        console.error(`Invalid pageDataSource: ${pageDataSourceArg}. Must be one of: ${Object.values(PageDataSource).join(', ')}`);
        process.exit(1);
    }

    main(saveMapDataHookFn, pageDataSource, pageId, routeId)
        .then(() => {
            console.log('Map data processing complete.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}