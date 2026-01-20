import getDatabaseConnection from '../helpers/getDatabaseConnection';
import { PageDataSource } from './types/mapData';
import getSourceFileUrl from './util/getSourceFileUrl';
import getPageRoute from './util/getPageRoute';
import { processMapData } from './processors/processMapData';
import upsertMapData from './database/upsertMapData';
import upsertPageRoute from './util/upsertPageRoute';
import { PageRoute } from '../types/pageRoute';

/**
 * Processes map data by reading source file URL from the database, downloading it,
 * converting to GeoJSON, then to MBTiles, and uploading to S3.
 * 
 * @param pageDataSource - Source of the page data (e.g., PageDataSource.Ropewiki)
 * @param pageId - ID of the page
 * @param routeId - ID of the route
 * @returns Promise that resolves when processing is complete
 */
export const main = async (
    pageDataSource: PageDataSource,
    pageId: string,
    routeId: string,
): Promise<void> => {
    const pool = await getDatabaseConnection();
    const client = await pool.connect();

    try {
        // Get existing pageRoute if there is one
        const existingPageRoute = await getPageRoute(client, pageDataSource, pageId, routeId);

        // Get the source file URL
        const sourceFileUrl = await getSourceFileUrl(client, pageDataSource, pageId);

        // Start with existing mapDataId if available
        let mapDataId: string | undefined = existingPageRoute?.mapData;

        // If source file exists, process it
        if (sourceFileUrl) {
            // Process the source file (download, convert, upload to S3)
            const mapData = await processMapData(sourceFileUrl, mapDataId);

            // Upsert the MapData object to the database
            const upsertedMapData = await upsertMapData(client, mapData);
            mapDataId = upsertedMapData.id;
        }

        // Use existing pageRoute or create a new one with the mapDataId
        const pageRoute = existingPageRoute 
            ? new PageRoute(existingPageRoute.route, existingPageRoute.page, mapDataId)
            : new PageRoute(routeId, pageId, mapDataId);

        // Upsert the page-route link (regardless of whether map data was created)
        await upsertPageRoute(client, pageDataSource, pageRoute);
    } finally {
        client.release();
        await pool.end();
    }
};

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

    main(pageDataSource, pageId, routeId)
        .then(() => {
            console.log('Map data processing complete.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}