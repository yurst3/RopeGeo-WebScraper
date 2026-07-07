import type { Pool, PoolClient } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getAllPages from '../database/getAllPages';
import sendProcessPageSQSMessage from '../sqs/sendProcessPageSQSMessage';

/**
 * Lambda handler that enqueues every non-deleted RopewikiPage to the page processor queue
 * so each page is re-fetched, parsed, and upserted (beta sections, images, site links).
 */
export const reprocessPagesHandler = async (): Promise<{ statusCode: number; body: string }> => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const pages = await getAllPages(client);

        console.log(`Enqueueing ${pages.length} RopewikiPages for page processing...`);

        for (const page of pages) {
            await sendProcessPageSQSMessage(page);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki pages completed successfully',
                enqueuedCount: pages.length,
            }),
        };
    } catch (error) {
        console.error('Error in RopewikiPageReprocessor:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki pages failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
    }
};
