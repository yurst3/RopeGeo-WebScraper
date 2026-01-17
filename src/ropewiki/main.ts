import processRegions from "./processors/processRegions"
import { getProcessPagesForRegionFn } from './processors/processPagesForRegion';
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
        // Fetch regions from API, upsert them, and get the mapping of names to IDs
        const regionNameIds = await processRegions(pool);
        // Find which regions have a page count under the limit
        const regionsUnderLimit = await getRegionCountsUnderLimit(pool, 'World', REGION_COUNT_LIMIT);
        console.log(`Getting pages from ${regionsUnderLimit.length} regions: ${regionsUnderLimit.map(r => r.name).join(', ')}`);

        // Collect all parsed page UUIDs from all regions
        const updatedPageUuids: string[] = [];

        // Get the processPagesForRegion function that uses the provided pool and hook function.
        const processPagesForRegion = getProcessPagesForRegionFn(pool, processPagesChunkHookFn);

        // Everything has to be done sequentially so we don't DDOS Ropewiki
        for (const region of regionsUnderLimit) {
            // Pull all pages in the region, parse them, upsert them
            const parsedPageUuids = await processPagesForRegion(region.name, region.pageCount, regionNameIds);
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