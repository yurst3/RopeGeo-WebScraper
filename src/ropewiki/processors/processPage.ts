import { PoolClient } from 'pg';
import { Queryable } from "zapatos/db";
import getRopewikiPageHtml from "../http/getRopewikiPageHtml";
import parseRopewikiPage from "../parsers/parseRopewikiPage";
import upsertBetaSections from "../database/upsertBetaSections";
import upsertImages from "../database/upsertImages";
import setBetaSectionsDeletedAt from "../database/setBetaSectionsDeletedAt";
import setImagesDeletedAt from "../database/setImagesDeletedAt";
import ProgressLogger from "../../helpers/progressLogger";

import RopewikiPage from "../types/page";

/**
 * Processes a single Ropewiki page.
 * Fetches HTML, parses it, and upserts beta sections and images.
 * 
 * @param client - Database client (should be a PoolClient in a transaction)
 * @param page - Page data to process
 * @param logger - Optional progress logger for tracking progress
 * @param savepointName - Optional savepoint name. If provided, creates savepoint and handles rollback/release
 */
const processPage = async (
    client: Queryable,
    page: RopewikiPage,
    logger?: ProgressLogger,
    savepointName?: string,
): Promise<void> => {
    // client should be a PoolClient that's already in a transaction
    const poolClient = client as PoolClient;

    // HTTP/parsing errors will propagate up the stack (not caught here)
    const pageHTML: string = await getRopewikiPageHtml(page.pageid);
    const { beta, images } = await parseRopewikiPage(pageHTML);

    // Create a savepoint if savepointName is provided
    if (savepointName) {
        await poolClient.query(`SAVEPOINT ${savepointName}`);
    }

    try {
        // Upsert beta sections and images, overriding the deletedAt date if any were set
        if (!page.id) {
            throw new Error(`Page must have an id to process: ${page.pageid}`);
        }
        const betaTitleIds = await upsertBetaSections(poolClient, page.id, beta, page.latestRevisionDate);
        const updatedBetaSectionIds = Object.values(betaTitleIds);
        const updatedImageIds = await upsertImages(poolClient, page.id, images, betaTitleIds, page.latestRevisionDate);

        // Assume that beta sections & images which have not been upserted are deleted
        await setBetaSectionsDeletedAt(poolClient, page.id, updatedBetaSectionIds);
        await setImagesDeletedAt(poolClient, page.id, updatedImageIds);

        // Release the savepoint on success if it was created
        if (savepointName) {
            await poolClient.query(`RELEASE SAVEPOINT ${savepointName}`);
        }
        
        if (logger) {
            logger.logProgress(`${page.pageid} ${page.name}`);
        }
    } catch (dbError) {
        // Rollback to the savepoint on database error if savepoint was created (this doesn't rollback the entire transaction)
        if (savepointName) {
            await poolClient.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        }
        console.error(`Error processing page ${page.pageid} ${page.name}, ${savepointName ? 'rolled back to savepoint' : 'failed'}:`, dbError);
        throw dbError;
    }
};

export { processPage };
