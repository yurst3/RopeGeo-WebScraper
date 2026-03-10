import type { SqsEvent, SqsRecord } from '@aws-lambda-powertools/parser/types';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import type { Pool, PoolClient } from 'pg';
import handleImageProcessorSQSMessages from '../sqs/handleImageProcessorSQSMessages';
import setImageProcessorSQSMessageVisibilityTimeout from '../sqs/setImageProcessorSQSMessageVisibilityTimeout';

/**
 * Lambda handler for processing image data (download, convert to AVIF, upload to S3).
 * Expects an SQS event with Records array containing ImageDataEvent in the body.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mainHandler = async (event: SqsEvent, context: any) => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        if (!event.Records || !Array.isArray(event.Records) || event.Records.length === 0) {
            throw new Error('Invalid SQS event: missing Records array or empty Records');
        }

        const timeoutSecondsRaw = process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS;
        const timeoutSeconds = timeoutSecondsRaw != null ? parseInt(timeoutSecondsRaw, 10) : NaN;
        if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
            throw new Error(
                `Invalid IMAGE_PROCESSOR_TIMEOUT_SECONDS: must be a positive number, got ${JSON.stringify(timeoutSecondsRaw)}`,
            );
        }
        const lambdaTimeoutMs = timeoutSeconds * 1000;

        const getRemainingTimeInMillis =
            context?.getRemainingTimeInMillis != null
                ? () => context.getRemainingTimeInMillis()
                : undefined;
        if (getRemainingTimeInMillis == null) {
            throw new Error(
                'getRemainingTimeInMillis is required (Lambda context.getRemainingTimeInMillis)',
            );
        }

        console.log(`Processing image data for ${event.Records.length} message(s)...`);

        for (const record of event.Records as SqsRecord[]) {
            await setImageProcessorSQSMessageVisibilityTimeout(record.receiptHandle);
        }

        const results = await handleImageProcessorSQSMessages(
            event.Records,
            client,
            lambdaTimeoutMs,
            getRemainingTimeInMillis,
        );
        const totalRecords = event.Records.length;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Processed image data for ${totalRecords} message(s)`,
                results,
            }),
        };
    } catch (error) {
        console.error('Error processing image data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to process image data',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
        if (pool) await pool.end();
    }
};
