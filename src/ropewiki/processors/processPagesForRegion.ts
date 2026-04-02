import { Pool, PoolClient } from 'pg';
import { Queryable } from "zapatos/db";
import getPagesForRegion from "../http/getPagesForRegion";
import RopewikiPage from "../types/page";
import updateLengthsForPages from "../util/updateLengthsForPages";
import getUpdatedDatesForPages from "../database/getUpdatedDatesForPages";
import upsertPages from "../database/upsertPages";
import setPagesDeletedAtForRegion from "../database/setPagesDeletedAtForRegion";
import setAkaNamesDeletedAtForRegion from "../database/setAkaNamesDeletedAtForRegion";
import { ProgressLogger } from 'ropegeo-common/helpers';
import type { ProcessPagesChunkHookFn } from "../hook-functions/processPagesChunk";

const CHUNK_SIZE = 2000; // DO NOT EXCEED 2000

type ProcessPagesForRegionFn = (regionName: string, regionPageCount: number, regionNameIds: {[name: string]: string}) => Promise<RopewikiPage[]>;

async function processUpdatedPages(
    client: PoolClient,
    processPagesChunkHookFn: ProcessPagesChunkHookFn,
    upsertedPages: RopewikiPage[],
    pageUpdateDates: { [pageId: string]: Date | null },
    validPagesLength: number,
    invalidPagesCount: number,
    offset: number,
    logger: ProgressLogger,
    parsedPages: RopewikiPage[],
): Promise<void> {
    const validPagesToParse = upsertedPages.filter(upsertPage => {
        const updatedDate = pageUpdateDates[upsertPage.pageid];

        if (!updatedDate) return true; // Always parse and save when we don't have an updated date
        return updatedDate < upsertPage.latestRevisionDate; // Otherwise only parse if there has been a revision since the last update
    });

    const skippedPagesCount = validPagesLength - validPagesToParse.length;
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
}

/* 
We want a more generic function that takes in a hook so we can either send SQS messages if we're running in a lambda or
directly invoke processPagesChunk if we're running as a node script. Remember that lambdas can only run for 900 seconds before they time
out and if we have to do a full scrape from scratch it will take roughly 3.5 hours. Europe alone takes about 2 hours.
*/
export const getProcessPagesForRegionFn = (
    conn: Queryable,
    processPagesChunkHookFn: ProcessPagesChunkHookFn,
    processPages: boolean,
): ProcessPagesForRegionFn => {
    return async (
        regionName: string,
        regionPageCount: number,
        regionNameIds: {[name: string]: string}
    ): Promise<RopewikiPage[]> => {
        const logger = new ProgressLogger(`Processing "${regionName}"`, regionPageCount);
        const parsedPages: RopewikiPage[] = [];
        const pool = conn as Pool;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const regionUuid = regionNameIds[regionName];
            if (!regionUuid) {
                throw new Error(`No region UUID found for region "${regionName}"`);
            }

            // Soft delete all the pages and their AKA names before we upsert and clear the deleteAt
            // Any pages that we don't upsert remain as "deleted"
            await setPagesDeletedAtForRegion(client, regionUuid);
            await setAkaNamesDeletedAtForRegion(client, regionUuid);

            for (let offset = 0; offset < regionPageCount; offset += CHUNK_SIZE) {
                console.log(`Getting pages ${offset + 1} to ${Math.min(offset + CHUNK_SIZE, regionPageCount)} in "${regionName}" (${regionPageCount} total pages)...`)
                // Has a limit of 2000 pages per request
                const pages: RopewikiPage[] = await getPagesForRegion(regionName, offset, CHUNK_SIZE, regionNameIds);

                // We only want to store valid pages (must have a pageid, name, region, url, and latestRevisionDate)
                const validPages: RopewikiPage[] = pages.filter(page => page.isValid);
                const invalidPagesCount = pages.length - validPages.length;
                if (invalidPagesCount > 0) console.log(`Skipping ${invalidPagesCount} invalid pages...`);

                // Ropewiki's semantic media wiki properties for length and elevation gain are bad (they strip the negative sign from elev gains, weird names for length properties)
                // We need to make a separate call to get the raw wiki text for each page and parse the length and elev gains from there
                await updateLengthsForPages(validPages);

                // Get updated dates BEFORE we upsert the new pages
                const pageUpdateDates: {[pageId: string]: Date | null} = await getUpdatedDatesForPages(conn, validPages.map(page => page.pageid));

                const upsertedPages = await upsertPages(client, validPages);

                if (processPages) {
                    await processUpdatedPages(
                        client,
                        processPagesChunkHookFn,
                        upsertedPages,
                        pageUpdateDates,
                        validPages.length,
                        invalidPagesCount,
                        offset,
                        logger,
                        parsedPages,
                    );
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error processing region "${regionName}", transaction rolled back:`, error);
            return [];
        } finally {
            client.release();
        }

        return parsedPages;
    }
}