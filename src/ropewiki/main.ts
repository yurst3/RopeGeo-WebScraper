import processRegionsPage from "./processors/processRegionsPage"
import { getProcessRegionFn } from './processors/processRegion';
import type { ProcessPagesChunkHookFn } from './hook-functions/processPagesChunk';
import getRegionCountsUnderLimit from './util/getRegionsUnderLimit';
import getDatabaseConnection from '../helpers/getDatabaseConnection';
import processRoutes from "./processors/processRoutes";
import { nodeProcessPagesChunk } from "./hook-functions/processPagesChunk";

/*
From testing, if the query for getting ropewiki pages ever has an offset above 5000 it treats it as an offset of 0.
If it ever has a limit above 2000, it treats it as a limit of 2000.
So if we want to get ALL pages for ALL regions we can't just use the root "World" region, we have to select regions with less than 7000 pages.
Since 7000 isn't a multiple of 2000, we'll go with 6000 to make the code a little cleaner.
*/
const REGION_COUNT_LIMIT = 6000;

export default async function main(processPagesChunkHookFn: ProcessPagesChunkHookFn): Promise<number> {
    const beginTime = new Date();
    const pool = await getDatabaseConnection();

    try {
        // If there has been a recent revision to the Regions page, pull the Regions, parse, upsert them, and return the resulting ids
        const regionNameIds: {[name: string]: string} = await processRegionsPage(pool);
        // Find which regions have a page count under the limit
        const regionCounts: {[name: string]: number} = await getRegionCountsUnderLimit(pool, 'World', REGION_COUNT_LIMIT);
        console.log(`Getting pages from ${Object.keys(regionCounts).length} regions: ${Object.keys(regionCounts).join(', ')}`);

        // Collect all parsed page UUIDs from all regions
        const updatedPageUuids: string[] = [];

        // Get the processRegion function that uses the provided pool and hook function.
        const processRegion = getProcessRegionFn(pool, processPagesChunkHookFn);

        // Everything has to be done sequentially so we don't DDOS Ropewiki
        for (const [region, count] of Object.entries(regionCounts)) {
            // Pull all pages in the region, parse them, upsert them
            const parsedPageUuids = await processRegion(region, count, regionNameIds);
            updatedPageUuids.push(...parsedPageUuids);
        }

        await processRoutes(pool, updatedPageUuids);

        const elapsedTimeMs = new Date().getTime() - beginTime.getTime();
        const elapsedTimeSeconds = Math.floor(elapsedTimeMs / 1000);
        
        return elapsedTimeSeconds;
    } finally {
        await pool.end();
    }
}

// Use the node hook functions which will directly invoke the processors
const processPagesChunkHookFn = nodeProcessPagesChunk;

// Allow running as a Node.js script
if (require.main === module) {
    main(processPagesChunkHookFn).then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}