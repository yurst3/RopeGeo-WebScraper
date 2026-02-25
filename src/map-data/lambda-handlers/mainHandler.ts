import type { SqsEvent, SqsRecord } from '@aws-lambda-powertools/parser/types';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import type { Pool, PoolClient } from 'pg';
import handleMapDataSQSMessages from '../sqs/handleMapDataSQSMessages';
import setMapDataSQSMessageVisibilityTimeout from '../sqs/setMapDataSQSMessageVisibilityTimeout';

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

        const timeoutSecondsRaw = process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS;
        const timeoutSeconds = timeoutSecondsRaw != null ? parseInt(timeoutSecondsRaw, 10) : NaN;
        if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
            throw new Error(
                `Invalid MAP_DATA_PROCESSOR_TIMEOUT_SECONDS: must be a positive number, got ${JSON.stringify(timeoutSecondsRaw)}`,
            );
        }
        const lambdaTimeoutMs = timeoutSeconds * 1000;

        const getRemainingTimeInMillis = context?.getRemainingTimeInMillis != null
            ? () => context.getRemainingTimeInMillis()
            : undefined;
        if (getRemainingTimeInMillis == null) {
            throw new Error('getRemainingTimeInMillis is required (Lambda context.getRemainingTimeInMillis)');
        }

        console.log(`Processing map data for ${event.Records.length} page routes...`);

        /*
        By default messages only remain "invisible" for 30 seconds before they move back to the "in-flight" state.
        We need to increase the visibility timeout for all messages so they don't become "visible" before we're done
        processing them. We do this by setting their visibility timeouts to the lambda's timeout value.
        Serialize these calls to avoid many concurrent SQS/DNS operations (getaddrinfo EBUSY).
        */
        for (const record of event.Records as SqsRecord[]) {
            await setMapDataSQSMessageVisibilityTimeout(record.receiptHandle);
        }

        const results = await handleMapDataSQSMessages(event.Records, client, lambdaTimeoutMs, getRemainingTimeInMillis);
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
