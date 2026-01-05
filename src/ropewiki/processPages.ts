import { Pool } from 'pg';
import { Queryable } from "zapatos/db";
import RopewikiPageInfo from "./types/ropewiki";
import getRopewikiPageHtml from "./http/getRopewikiPageHtml";
import parseRopewikiPage from "./parsers/parseRopewikiPage";
import upsertPage from "./database/upsertPage";
import upsertBetaSections from "./database/upsertBetaSections";
import upsertImages from "./database/upsertImages";
import setBetaSectionsDeletedAt from "./database/setBetaSectionsDeletedAt";
import setImagesDeletedAt from "./database/setImagesDeletedAt";
import ProgressLogger from "../helpers/progressLogger";

const processPages = async (
    conn: Queryable,
    pages: RopewikiPageInfo[],
    pageRevisionDates: {[pageId: string]: Date | null},
    regionNameIds: {[name: string]: string},
    logger: ProgressLogger,
) => {
    // Get a client from the pool for transactions
    const pool = conn as Pool;

    for (const page of pages) {
        const latestRevisionDate: Date | null | undefined = pageRevisionDates[page.pageid];
        if (!latestRevisionDate) { // This should never be null/undefined since we already filtered pages
            logger.logProgress(`Skipped ${page.pageid} ${page.name} (no revision date)`);
            continue; 
        }
        const regionId: string | undefined = regionNameIds[page.region];
        if (!regionId) {
            console.error(`${page.pageid} ${page.name} doesn't have a valid region: ${page.region}`);
            logger.logProgress(`Skipped ${page.pageid} ${page.name} (invalid region)`);
            continue;
        }

        const pageHTML: string = await getRopewikiPageHtml(page.pageid);
        const { beta, images } = await parseRopewikiPage(pageHTML);

        // Get a client and start a transaction for database operations
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pageUuid: string = await upsertPage(client, page, regionId, latestRevisionDate);

            // Upsert beta sections and image, overriding the deletedAt date if any were set
            const betaTitleIds = await upsertBetaSections(client, pageUuid, beta, latestRevisionDate);
            const updatedBetaSectionIds = Object.values(betaTitleIds);
            const updatedImageIds = await upsertImages(client, pageUuid, images, betaTitleIds, latestRevisionDate);

            // Assume that beta sections & images which have not been upserted are deleted
            await setBetaSectionsDeletedAt(client, pageUuid, updatedBetaSectionIds);
            await setImagesDeletedAt(client, pageUuid, updatedImageIds);

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error processing page ${page.pageid} ${page.name}, transaction rolled back:`, error);
            throw error;
        } finally {
            client.release();
        }
        
        logger.logProgress(`${page.pageid} ${page.name}`);
    }
}

export default processPages;