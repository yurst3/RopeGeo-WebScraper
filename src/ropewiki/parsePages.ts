import { Pool } from 'pg';
import { Queryable } from "zapatos/db";
import getRopewikiPageHtml from "./http/getRopewikiPageHtml";
import parseRopewikiPage from "./parsers/parseRopewikiPage";
import upsertBetaSections from "./database/upsertBetaSections";
import upsertImages from "./database/upsertImages";
import setBetaSectionsDeletedAt from "./database/setBetaSectionsDeletedAt";
import setImagesDeletedAt from "./database/setImagesDeletedAt";
import ProgressLogger from "../helpers/progressLogger";

type PageToParse = {
    id: string; // pageUuid for beta sections and images
    pageId: string; // argument passed to getRopewikiPageHtml()
    name: string; // page name for logging
    latestRevisionDate: Date; // required for upserting beta sections and images
};

const parsePages = async (
    conn: Queryable,
    pages: PageToParse[],
    logger: ProgressLogger,
) => {
    // Get a client from the pool for transactions
    const pool = conn as Pool;

    for (const page of pages) {
        const pageHTML: string = await getRopewikiPageHtml(page.pageId);
        const { beta, images } = await parseRopewikiPage(pageHTML);

        // Get a client and start a transaction for database operations
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Upsert beta sections and images, overriding the deletedAt date if any were set
            const betaTitleIds = await upsertBetaSections(client, page.id, beta, page.latestRevisionDate);
            const updatedBetaSectionIds = Object.values(betaTitleIds);
            const updatedImageIds = await upsertImages(client, page.id, images, betaTitleIds, page.latestRevisionDate);

            // Assume that beta sections & images which have not been upserted are deleted
            await setBetaSectionsDeletedAt(client, page.id, updatedBetaSectionIds);
            await setImagesDeletedAt(client, page.id, updatedImageIds);

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error processing page ${page.pageId} ${page.name}, transaction rolled back:`, error);
            throw error;
        } finally {
            client.release();
        }
        
        logger.logProgress(`${page.pageId} ${page.name}`);
    }
}

export default parsePages;
