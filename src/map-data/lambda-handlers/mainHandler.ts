import type { SqsEvent } from '@aws-lambda-powertools/parser/types';
import ProgressLogger from '../../helpers/progressLogger';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import type { Pool, PoolClient } from 'pg';
import handleMapDataSQSMessages from '../sqs/handleMapDataSQSMessages';

/**
 * Lambda handler for processing map data (KML to MBTiles conversion).
 * Expects an SQS event with Records array containing the MapDataEvent in the body.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mainHandler = async (event: SqsEvent, context: any) => {
    let pool: Pool | undefined; 
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        // Validate SQS event format
        if (!event.Records || !Array.isArray(event.Records) || event.Records.length === 0) {
            throw new Error('Invalid SQS event: missing Records array or empty Records');
        }

        console.log(`Processing map data for ${event.Records.length} page routes...`)

        // Initialize progress logger
        const logger = new ProgressLogger('Processing map data', 1);
        logger.setChunk(0, 1);

        const results = await handleMapDataSQSMessages(event.Records, client);
        const totalRecords = event.Records.length;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Processed map data for ${totalRecords} page routes`,
                results,
            }),
        };
    } catch (error) {
        console.error('Error processing map data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to process map data',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
        if (pool) await pool.end();
    }
};
