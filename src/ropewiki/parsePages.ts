import { PoolClient } from 'pg';
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
    client: Queryable,
    pages: PageToParse[],
    logger: ProgressLogger,
) => {
    // client should be a PoolClient that's already in a transaction
    const poolClient = client as PoolClient;

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i]!;
        const savepointName = `sp_page_${i}`;
        
        try {
            const pageHTML: string = await getRopewikiPageHtml(page.pageId);
            const { beta, images } = await parseRopewikiPage(pageHTML);

            // Create a savepoint for this page's database operations
            await poolClient.query(`SAVEPOINT ${savepointName}`);

            try {
                // Upsert beta sections and images, overriding the deletedAt date if any were set
                const betaTitleIds = await upsertBetaSections(poolClient, page.id, beta, page.latestRevisionDate);
                const updatedBetaSectionIds = Object.values(betaTitleIds);
                const updatedImageIds = await upsertImages(poolClient, page.id, images, betaTitleIds, page.latestRevisionDate);

                // Assume that beta sections & images which have not been upserted are deleted
                await setBetaSectionsDeletedAt(poolClient, page.id, updatedBetaSectionIds);
                await setImagesDeletedAt(poolClient, page.id, updatedImageIds);

                // Release the savepoint on success
                await poolClient.query(`RELEASE SAVEPOINT ${savepointName}`);
                
                logger.logProgress(`${page.pageId} ${page.name}`);
            } catch (dbError) {
                // Rollback to the savepoint on database error (this doesn't rollback the entire transaction)
                await poolClient.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                console.error(`Error processing page ${page.pageId} ${page.name}, rolled back to savepoint:`, dbError);
                // Continue processing other pages instead of throwing
            }
        } catch (error) {
            // For HTTP/parsing errors, log and continue (no savepoint to rollback to)
            console.error(`Error fetching/parsing page ${page.pageId} ${page.name}, skipping:`, error);
            // Continue processing other pages
        }
    }
}

export default parsePages;
