import { PoolClient } from 'pg';
import { Queryable } from "zapatos/db";
import getRopewikiPageHtml from "../http/getRopewikiPageHtml";
import parseRopewikiPage from "../parsers/parseRopewikiPage";
import upsertBetaSections from "../database/upsertBetaSections";
import upsertImages from "../database/upsertImages";
import upsertSiteLinks from "../database/upsertSiteLinks";
import setBetaSectionsDeletedAt from "../database/setBetaSectionsDeletedAt";
import setImagesDeletedAt from "../database/setImagesDeletedAt";
import setPageSiteLinksDeletedAt from "../database/setPageSiteLinksDeletedAt";
import ProgressLogger from "../../helpers/progressLogger";

import RopewikiPage from "../types/page";

/**
 * Processes a single Ropewiki page.
 * Fetches HTML, parses it, and upserts beta sections and images.
 * 
 * @param client - Database client (should be a PoolClient in a transaction)
 * @param page - Page data to process
 * @param logger - Progress logger for tracking progress
 * @param savepointName - Savepoint name. Creates savepoint and handles rollback/release
 */
const processPage = async (
    client: Queryable,
    page: RopewikiPage,
    logger: ProgressLogger,
    savepointName: string,
): Promise<void> => {
    // client should be a PoolClient that's already in a transaction
    const poolClient = client as PoolClient;

    // HTTP errors will propagate up the stack (not caught here)
    const pageHTML: string = await getRopewikiPageHtml(page.pageid);

    // Create a savepoint
    await poolClient.query(`SAVEPOINT ${savepointName}`);

    try {
        // Upsert beta sections and images, overriding the deletedAt date if any were set
        if (!page.id) {
            throw new Error(`Page must have an id to process: ${page.pageid}`);
        }

        // Parse the page into its beta sections and images
        const { beta, images } = await parseRopewikiPage(pageHTML);

        // Soft-delete all existing beta sections, images, and page-site links for this page
        // so we can upsert the new set without unique constraint conflicts.
        await setBetaSectionsDeletedAt(poolClient, page.id);
        await setImagesDeletedAt(poolClient, page.id);
        await setPageSiteLinksDeletedAt(poolClient, page.id);

        // Upsert the new beta sections, images, and site links
        const betaTitleIds = await upsertBetaSections(poolClient, page.id, beta, page.latestRevisionDate);
        await upsertImages(poolClient, page.id, images, betaTitleIds, page.latestRevisionDate);
        await upsertSiteLinks(poolClient, page.id, page.betaSites);

        // Release the savepoint on success
        await poolClient.query(`RELEASE SAVEPOINT ${savepointName}`);
        
        logger.logProgress(`${page.pageid} ${page.name}`);
    } catch (error) {
        // Rollback to the savepoint on error (this doesn't rollback the entire transaction)
        await poolClient.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.logError(`Error processing page ${page.pageid} ${page.name}, rolled back to savepoint: ${errorMessage}`);
    }
};

export { processPage };
