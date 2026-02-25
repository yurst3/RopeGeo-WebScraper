import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import type { Pool, PoolClient } from 'pg';
import getRopewikiPageById from '../database/getRopewikiPageById';
import { processPage } from '../processors/processPage';
import ProgressLogger from '../../helpers/progressLogger';

/**
 * Event payload for the ReprocessPage Lambda (manually triggered).
 * The id is the RopewikiPage UUID.
 */
export interface ReprocessPageEvent {
    id: string;
}

/**
 * Lambda handler for reprocessing a single Ropewiki page (manually triggered).
 * Expects an event with id (RopewikiPage UUID). Fetches the page, then runs processPage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const reprocessPageHandler = async (event: unknown, _context: any) => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        if (
            !event ||
            typeof event !== 'object' ||
            !('id' in event) ||
            typeof (event as ReprocessPageEvent).id !== 'string'
        ) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Invalid event: required id (string) is missing',
                }),
            };
        }

        const { id } = event as ReprocessPageEvent;

        pool = await getDatabaseConnection();
        client = await pool.connect();

        const page = await getRopewikiPageById(client, id);
        if (!page) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: `RopewikiPage not found or deleted: ${id}`,
                }),
            };
        }

        const logger = new ProgressLogger('Reprocess Ropewiki page', 1);
        logger.setChunk(0, 1);

        await client.query('BEGIN');
        await processPage(client, page, logger, 'sp_reprocess');
        await client.query('COMMIT');

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Processed page ${page.pageid} ${page.name}`,
            }),
        };
    } catch (error) {
        console.error('Error in reprocessPageHandler:', error);
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch {
                // ignore rollback error
            }
        }
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to process page',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
        if (pool) await pool.end();
    }
};
