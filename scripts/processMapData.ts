import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import getDatabaseConnection from '../src/helpers/getDatabaseConnection';
import { PageDataSource } from 'ropegeo-common';
import { RopewikiRoute } from '../src/types/pageRoute';
import { main } from '../src/map-data/main';
import { nodeSaveMapData } from '../src/map-data/hook-functions/saveMapData';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';

const queries: Record<PageDataSource, string> = {
    [PageDataSource.Ropewiki]: `SELECT rr.* FROM "RopewikiRoute" rr
        JOIN "RopewikiPage" rp ON rr."ropewikiPage" = rp.id
        WHERE rr."deletedAt" IS NULL AND rp."deletedAt" IS NULL AND rp."kmlUrl" IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 1`,
};

/**
 * Script to process map data for a random page route from the database.
 * Usage: ts-node processMapData.ts <pageRouteType>
 * Currently only 'ropewiki' is supported.
 */
async function processMapDataScript() {
    const pageRouteTypeArg = process.argv[2];

    if (!pageRouteTypeArg) {
        console.error('Usage: ts-node processMapData.ts <pageRouteType>');
        console.error('Currently only "ropewiki" is supported.');
        process.exit(1);
    }

    if (!Object.values(PageDataSource).includes(pageRouteTypeArg as PageDataSource)) {
        console.error(`Invalid pageRouteType: ${pageRouteTypeArg}. pageRouteType must be one of ${Object.values(PageDataSource).join(', ')}`);
        process.exit(1);
    }

    const pool = await getDatabaseConnection();
    const client = await pool.connect();

    try {
        // Select a random RopewikiRoute from the database
        const pageRouteType = pageRouteTypeArg as PageDataSource;
        const result = await pool.query<s.RopewikiRoute.JSONSelectable>(
            queries[pageRouteType],
        );

        if (result.rows.length === 0) {
            throw new Error('No RopewikiRoute found in the database');
        }

        // Convert the database row to a RopewikiRoute object
        const ropewikiRoute = RopewikiRoute.fromDbRow(result.rows[0]!);

        // Log the selected route
        console.log(`Selected RopewikiRoute - Route: ${ropewikiRoute.route}, Page: ${ropewikiRoute.page}, MapData: ${ropewikiRoute.mapData ?? 'none'}`);

        // Convert RopewikiRoute to MapDataEvent
        const mapDataEvent = ropewikiRoute.toMapDataEvent();

        // Initialize progress logger
        const logger = new ProgressLogger('Processing map data', 1);
        logger.setChunk(0, 1);

        // Process the map data
        await main(mapDataEvent, nodeSaveMapData, logger, client);

        console.log('Map data processing complete.');
    } catch (error) {
        console.error('Error processing map data:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the script
if (require.main === module) {
    processMapDataScript();
}
