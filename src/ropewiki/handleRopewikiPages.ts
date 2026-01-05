import { Queryable } from "zapatos/db";
import getRopewikiPageInfoForRegion from "./http/getRopewikiPageInfoForRegion";
import RopewikiPageInfo from "./types/ropewiki";
import getRopewikiPagesRevisionDates from "./http/getRopewikiPageRevisionDate";
import getUpdatedDatesForPages from "./database/getUpdatedDatesForPages";
import processPages from "./processPages";
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
        const pages: RopewikiPageInfo[] = await getRopewikiPageInfoForRegion(regionName, offset, CHUNK_SIZE);

        // We only want to store valid pages (must have a pageid, name, region, and url)
        const validPages: RopewikiPageInfo[] = pages.filter(page => page.isValid);
        const validPageIds: string[] = validPages.map(page => page.pageid);

        const invalidPagesCount = pages.length - validPages.length;
        if (invalidPagesCount > 0) console.log(`Skipping ${invalidPagesCount} invalid pages...`)

        // Has a limit of 50 pageIds per request (will chunk into requests with 50 ids if larger)
        const pageRevisionDates: {[pageId: string]: Date | null} = await getRopewikiPagesRevisionDates(validPageIds);
        const pageUpdateDates: {[pageId: string]: Date | null} = await getUpdatedDatesForPages(conn, validPageIds);

        const validPagesToParse: RopewikiPageInfo[] = validPages.filter(page => {
            const revisionDate = pageRevisionDates[page.pageid];
            const updatedDate = pageUpdateDates[page.pageid];

            if (!revisionDate) return false; // Ignore pages where we couldn't find a latest revision date
            if (!updatedDate) return true; // Always parse and save when we don't have an updated date
            return updatedDate < revisionDate; // Otherwise only parse if there has been a revision since the last update
        });

        const skippedPagesCount = validPages.length - validPagesToParse.length;
        if (skippedPagesCount > 0) console.log(`Skipping parsing/updating for ${skippedPagesCount} pages...`); 

        // Calculate chunk boundaries: start at offset + number of skipped pages in this chunk
        const skippedInChunk = invalidPagesCount + skippedPagesCount;
        
        if (validPagesToParse.length) {
            const chunkStart = offset + skippedInChunk;
            const chunkEnd = chunkStart + validPagesToParse.length - 1;
            logger.setChunk(chunkStart, chunkEnd);
            
            await processPages(conn, validPagesToParse, pageRevisionDates, regionNameIds, logger);
        }
    }
}

export default handleRopewikiPages;