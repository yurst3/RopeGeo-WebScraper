import { Queryable } from "zapatos/db";
import getRopewikiPageInfoForRegion from "./http/getRopewikiPageInfoForRegion";
import RopewikiPageInfo from "./types/ropewiki";
import getUpdatedDatesForPages from "./database/getUpdatedDatesForPages";
import upsertPages from "./database/upsertPages";
import parsePages from "./parsePages";
import ProgressLogger from "../helpers/progressLogger";

const CHUNK_SIZE = 2000; // DO NOT EXCEED 2000

const handleRopewikiPages = async (
    conn: Queryable,
    regionName: string,
    regionPageCount: number,
    regionNameIds: {[name: string]: string}
) => {
    const logger = new ProgressLogger(`Processing "${regionName}"`, regionPageCount);

    for (let offset = 0; offset < regionPageCount; offset += CHUNK_SIZE) {
        console.log(`Getting pages ${offset + 1} to ${Math.min(offset + CHUNK_SIZE, regionPageCount)} in "${regionName}" (${regionPageCount} total pages)...`)
        // Has a limit of 2000 pages per request
        const pages: RopewikiPageInfo[] = await getRopewikiPageInfoForRegion(regionName, offset, CHUNK_SIZE, regionNameIds);

        // We only want to store valid pages (must have a pageid, name, region, url, and latestRevisionDate)
        const validPages: RopewikiPageInfo[] = pages.filter(page => page.isValid);
        const invalidPagesCount = pages.length - validPages.length;
        if (invalidPagesCount > 0) console.log(`Skipping ${invalidPagesCount} invalid pages...`)

        // Get updated dates BEFORE we upsert the new pages
        const pageUpdateDates: {[pageId: string]: Date | null} = await getUpdatedDatesForPages(conn, validPages.map(page => page.pageid));

        const upsertedPages = await upsertPages(conn, validPages);

        const validPagesToParse = upsertedPages.filter(upsertPage => {
            const updatedDate = pageUpdateDates[upsertPage.pageId];

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
            
            // Parse pages (beta sections and images)
            await parsePages(conn, validPagesToParse, logger);
        }
    }
}

export default handleRopewikiPages;