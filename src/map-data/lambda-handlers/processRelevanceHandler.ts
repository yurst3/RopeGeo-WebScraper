import type { SqsEvent, SqsRecord } from '@aws-lambda-powertools/parser/types';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import type { Pool, PoolClient } from 'pg';
import handleRelevanceSQSMessages from '../sqs/handleRelevanceSQSMessages';
import setRelevanceSQSMessageVisibilityTimeout from '../sqs/setRelevanceSQSMessageVisibilityTimeout';
import { getRelevanceProcessorTimeoutMs } from '../util/getRelevanceProcessorTimeoutMs';

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

        const lambdaTimeoutMs = getRelevanceProcessorTimeoutMs();

        const getRemainingTimeInMillis =
            context?.getRemainingTimeInMillis != null
                ? () => context.getRemainingTimeInMillis()
                : undefined;
        if (getRemainingTimeInMillis == null) {
            throw new Error(
                'getRemainingTimeInMillis is required (Lambda context.getRemainingTimeInMillis)',
            );
        }

        console.log(`Processing map data relevance for ${event.Records.length} job(s)...`);

        for (const record of event.Records as SqsRecord[]) {
            await setRelevanceSQSMessageVisibilityTimeout(record.receiptHandle);
        }

        const results = await handleRelevanceSQSMessages(
            event.Records,
            client,
            lambdaTimeoutMs,
            getRemainingTimeInMillis,
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Processed map data relevance for ${event.Records.length} job(s)`,
                results,
            }),
        };
    } catch (error) {
        console.error('Error processing map data relevance:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to process map data relevance',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
    }
};
