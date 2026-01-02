/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
import { Pool } from 'pg';
import handleRopewikiRegions from "./handleRopewikiRegions"
import handleRopewikiPages from './handleRopewikiPages';
import getRegionCountsUnderLimit from './getRegionsUnderLimit';

/*
From testing, if the query for getting ropewiki pages ever has an offset above 5000 it treats it as an offset of 0.
If it ever has a limit above 2000, it treats it as a limit of 2000.
So if we want to get ALL pages for ALL regions we can't just use the root "World" region, we have to select regions with less than 7000 pages.
Since 7000 isn't a multiple of 2000, we'll go with 6000 to make the code a little cleaner.
*/
const REGION_COUNT_LIMIT = 6000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ropewikiScraperHandler = async (event: unknown, context: any) => {
    const beginTime = new Date();
    const pool = new Pool({
        host: process.env.DEVELOPMENT_DB_HOST,
        database: process.env.DEVELOPMENT_DB_NAME,
    });

    try {
        // If there has been a recent revision to the Regions page, pull the Regions, parse, upsert them, and return the resulting ids
        const regionNameIds: {[name: string]: string} = await handleRopewikiRegions(pool);
        // Find which regions have a page count under the limit
        const regionCounts: {[name: string]: number} = await getRegionCountsUnderLimit(pool, 'World', REGION_COUNT_LIMIT);
        console.log(`Getting pages from ${Object.keys(regionCounts).length} regions: ${Object.keys(regionCounts).join(', ')}`);

        // Everything has to be done sequentially so we don't DDOS Ropewiki
        for (const [region, count] of Object.entries(regionCounts)) {
            // Pull all pages in the region, parse them, upsert them
            await handleRopewikiPages(pool, region, count, regionNameIds);
        }

        const totalTime = (new Date().getTime()) - beginTime.getTime();
        const totalTimeHours = Math.floor(totalTime / (1000 * 60 * 60));
        const totalTimeMinutes = Math.floor(totalTime / (1000 * 60)) - (totalTimeHours * 60);
        const totalTimeSeconds = Math.floor(totalTime / 1000) - (totalTimeMinutes * 60);
        console.log(`\nTotal time: ${totalTimeHours}h ${totalTimeMinutes}m ${totalTimeSeconds}s`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Ropewiki scraper completed successfully',
                regionsProcessed: Object.keys(regionCounts).length,
                totalTime: `${totalTimeHours}h ${totalTimeMinutes}m ${totalTimeSeconds}s`,
            }),
        };
    } catch (error) {
        console.error('Error in Ropewiki scraper:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki scraper failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        await pool.end();
    }
};