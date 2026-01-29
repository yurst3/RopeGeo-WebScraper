import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { PoolClient } from 'pg';
import { Queryable } from 'zapatos/db';
import { processPage } from '../processors/processPage';
import RopewikiPage from '../types/page';
import ProgressLogger from '../../helpers/progressLogger';

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

    const queueUrl = process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set');
    }

    const sqsClient = new SQSClient({});
    
    // Send a message for each page
    for (const page of upsertedPages) {
        try {
            const command = new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify(page),
            });
            
            await sqsClient.send(command);
            
            logger.logProgress(`Sent page ${page.pageid} ${page.name} to queue`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error sending page ${page.pageid} ${page.name} to queue: ${errorMessage}`);
        }
    }
};
