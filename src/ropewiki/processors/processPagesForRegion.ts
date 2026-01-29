import { Pool } from 'pg';
import { Queryable } from "zapatos/db";
import getRopewikiPageForRegion from "../http/getRopewikiPageForRegion";
import RopewikiPage from "../types/page";
import getUpdatedDatesForPages from "../database/getUpdatedDatesForPages";
import upsertPages from "../database/upsertPages";
import ProgressLogger from "../../helpers/progressLogger";
import type { ProcessPagesChunkHookFn } from "../hook-functions/processPagesChunk";

const CHUNK_SIZE = 2000; // DO NOT EXCEED 2000

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT;

type ProcessPagesForRegionFn = (regionName: string, regionPageCount: number, regionNameIds: {[name: string]: string}) => Promise<RopewikiPage[]>;

/* 
We want a more generic function that takes in a hook so we can either send SQS messages if we're running in a lambda or
directly invoke processPagesChunk if we're running as a node script. Remember that lambdas can only run for 900 seconds before they time
out and if we have to do a full scrape from scratch it will take roughly 3.5 hours. Europe alone takes about 2 hours.
*/
export const getProcessPagesForRegionFn = (conn: Queryable, processPagesChunkHookFn: ProcessPagesChunkHookFn): ProcessPagesForRegionFn => {
    return async (
        regionName: string,
        regionPageCount: number,
        regionNameIds: {[name: string]: string}
    ): Promise<RopewikiPage[]> => {
        const logger = new ProgressLogger(`Processing "${regionName}"`, regionPageCount);
        const parsedPages: RopewikiPage[] = [];
    
        for (let offset = 0; offset < regionPageCount; offset += CHUNK_SIZE) {
            console.log(`Getting pages ${offset + 1} to ${Math.min(offset + CHUNK_SIZE, regionPageCount)} in "${regionName}" (${regionPageCount} total pages)...`)
            // Has a limit of 2000 pages per request
            const pages: RopewikiPage[] = await getRopewikiPageForRegion(regionName, offset, CHUNK_SIZE, regionNameIds);
    
            // We only want to store valid pages (must have a pageid, name, region, url, and latestRevisionDate)
            const validPages: RopewikiPage[] = pages.filter(page => page.isValid);
            const invalidPagesCount = pages.length - validPages.length;
            if (invalidPagesCount > 0) console.log(`Skipping ${invalidPagesCount} invalid pages...`)
    
            // Get updated dates BEFORE we upsert the new pages
            const pageUpdateDates: {[pageId: string]: Date | null} = await getUpdatedDatesForPages(conn, validPages.map(page => page.pageid));
    
            // Get a client from the pool for the transaction
            const pool = conn as Pool;
            const client = await pool.connect();
            
            try {
                // Begin transaction 
                if (!isLambda) await client.query('BEGIN');
    
                const upsertedPages = await upsertPages(client, validPages);
    
                const validPagesToParse = upsertedPages.filter(upsertPage => {
                    const updatedDate = pageUpdateDates[upsertPage.pageid];

                    if (!updatedDate) return true; // Always parse and save when we don't have an updated date
                    return updatedDate < upsertPage.latestRevisionDate; // Otherwise only parse if there has been a revision since the last update
                });
    
                const skippedPagesCount = validPages.length - validPagesToParse.length;
                if (skippedPagesCount > 0) console.log(`Skipping parsing for ${skippedPagesCount} pages...`); 
    
                // Calculate chunk boundaries: start at offset + number of skipped pages in this chunk
                const skippedInChunk = invalidPagesCount + skippedPagesCount;
    
                if (validPagesToParse.length) {
                    const chunkStart = offset + skippedInChunk;
                    const chunkEnd = chunkStart + validPagesToParse.length - 1;
                    logger.setChunk(chunkStart, chunkEnd);
                    
                    // Parse pages (beta sections and images) - uses savepoints internally
                    await processPagesChunkHookFn(client, validPagesToParse, logger);
                    
                    // Track the full page objects that were parsed
                    parsedPages.push(...validPagesToParse);
                }
    
                // Commit transaction
                if (!isLambda) await client.query('COMMIT');
            } catch (error) {
                // Rollback transaction on error
                if (!isLambda) await client.query('ROLLBACK');
                console.error(`Error processing chunk at offset ${offset} for region "${regionName}", transaction rolled back:`, error);
                throw error;
            } finally {
                client.release();
            }
        }
    
        return parsedPages;
    }
}