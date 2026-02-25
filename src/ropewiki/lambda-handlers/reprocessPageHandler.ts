import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import type { Pool, PoolClient } from 'pg';
import getRopewikiRoutesWithoutMapDataWithKmlPage from '../database/getRopewikiRoutesWithoutMapDataWithKmlPage';
import sendMapDataSQSMessage from '../sqs/sendMapDataSQSMessage';
import ProgressLogger from '../../helpers/progressLogger';

/**
 * Event payload for the ReprocessPage Lambda (manually triggered).
 * No required fields; handler fetches PageRoutes without mapData whose page has kmlUrl.
 */
export interface ReprocessPageEvent {
    [key: string]: unknown;
}

/**
 * Lambda handler: gets all RopewikiRoutes that have no mapData and whose page has a kmlUrl,
 * and sends each to the MapDataProcessingQueue. Uses a progress logger to log sending progress.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const reprocessPageHandler = async (_event: unknown, _context: any) => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const routes = await getRopewikiRoutesWithoutMapDataWithKmlPage(client);
        const total = routes.length;

        const logger = new ProgressLogger('Send PageRoutes without mapData to MapDataProcessingQueue', total);
        logger.setChunk(0, total);

        for (const route of routes) {
            try {
                await sendMapDataSQSMessage(route);
                logger.logProgress(`route ${route.route} / page ${route.page}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.logError(`Failed to send route ${route.route} / page ${route.page}: ${message}`);
            }
        }

        const { successes, errors } = logger.getResults();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Sent ${successes} messages to MapDataProcessingQueue; ${errors} errors`,
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
                message: 'Failed to get PageRoutes or send messages',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
        if (pool) await pool.end();
    }
};
