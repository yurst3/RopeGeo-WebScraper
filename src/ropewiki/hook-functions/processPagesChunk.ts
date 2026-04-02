import { PoolClient } from 'pg';
import { Queryable } from 'zapatos/db';
import { processPage } from '../processors/processPage';
import RopewikiPage from '../types/page';
import { ProgressLogger } from 'ropegeo-common/helpers';
import sendProcessPageSQSMessage from '../sqs/sendProcessPageSQSMessage';

export type ProcessPagesChunkHookFn = (client: PoolClient, upsertedPages: RopewikiPage[], logger: ProgressLogger) => Promise<void>;

/**
 * Hook function for Node.js that processes pages directly.
 * Processes multiple pages in a chunk by calling processPage for each page.
 * 
 * @param client - Database client (should be a PoolClient in a transaction)
 * @param pages - Array of page data to process
 * @param logger - Progress logger for tracking progress
 */
export const nodeProcessPagesChunk = async (
    client: Queryable,
    pages: RopewikiPage[],
    logger: ProgressLogger,
): Promise<void> => {
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i]!;
        const savepointName = `sp_page_${i}`;
        
        // HTTP/parsing errors will propagate up (not caught here)
        // Only database errors after savepoint creation are caught and handled per-page
        await processPage(client, page, logger, savepointName);
    }
};

/**
 * Hook function for Lambda that sends SQS messages to RopewikiPageProcessingQueue for each page.
 * If DEV_ENVIRONMENT is "local", skips sending messages and logs instead.
 */
export const lambdaProcessPagesChunk: ProcessPagesChunkHookFn = async (
    client: PoolClient,
    upsertedPages: RopewikiPage[],
    logger: ProgressLogger,
): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log(`Skipping SQS message sending for ${upsertedPages.length} page(s) - no queue configured locally`);
        return;
    }

    for (const page of upsertedPages) {
        await sendProcessPageSQSMessage(page);
        logger.logProgress(`Sent page ${page.pageid} ${page.name} to queue`);
    }
};
