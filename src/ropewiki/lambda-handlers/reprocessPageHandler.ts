import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import type { Pool, PoolClient } from 'pg';
import getRopewikiPagesWithoutBetaSections from '../database/getRopewikiPagesWithoutBetaSections';
import sendProcessPageSQSMessage from '../sqs/sendProcessPageSQSMessage';
import ProgressLogger from '../../helpers/progressLogger';

/**
 * Event payload for the ReprocessPage Lambda (manually triggered).
 * The id is the RopewikiPage UUID.
 */
export interface ReprocessPageEvent {
    id: string;
}

/**
 * Lambda handler: gets all Ropewiki pages with no beta sections and sends each to the
 * RopewikiPageProcessing queue. Uses a progress logger to log sending progress.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const reprocessPageHandler = async (_event: unknown, _context: any) => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const pages = await getRopewikiPagesWithoutBetaSections(client);
        const total = pages.length;

        const logger = new ProgressLogger('Send pages without beta sections to queue', total);
        logger.setChunk(0, total);

        for (const page of pages) {
            try {
                await sendProcessPageSQSMessage(page);
                logger.logProgress(`${page.pageid} ${page.name}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.logError(`Failed to send ${page.pageid} ${page.name}: ${message}`);
            }
        }

        const { successes, errors } = logger.getResults();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Sent ${successes} messages to queue; ${errors} errors`,
                total,
                successes,
                errors,
            }),
        };
    } catch (error) {
        console.error('Error in reprocessPageHandler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to get pages or send messages',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
        if (pool) await pool.end();
    }
};
