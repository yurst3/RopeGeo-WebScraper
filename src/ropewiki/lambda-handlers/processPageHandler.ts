import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import type { SqsEvent } from '@aws-lambda-powertools/parser/types';
import handleProcessPageSQSMessages from '../sqs/handleProcessPageSQSMessages';
import setProcessPageSQSMessageVisibilityTimeout from '../sqs/setProcessPageSQSMessageVisibilityTimeout';
import type { Pool, PoolClient } from 'pg';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';

/**
 * Lambda handler for processing multiple Ropewiki pages from an SQS event.
 * Expects an SQS event with Records array containing RopewikiPage data in each record's body.
 * Uses savepoints for each page processing. If there is an HTTP error from processPage(), the entire transaction is rolled back.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const processPageHandler = async (event: SqsEvent, context: any) => {
    let pool: Pool | undefined; 
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        // Validate SQS event format
        if (!event.Records || !Array.isArray(event.Records) || event.Records.length === 0) {
            throw new Error('Invalid SQS event: missing Records array or empty Records');
        }

        console.log(`Processing ${event.Records.length} messages...`);

        /* 
        By default messages only remain "invisibile" for 30 seconds before they move back to the "in-flight" state.
        We need to increase the visibility timeout for all messages so they don't become "visible" before we're done
        processing them. We do this by setting their visibility timeouts to the lambda's timeout value, that way the
        lambda will always finish before the messages become visibile again.
        */
        await Promise.all((event.Records as SqsRecord[]).map(record => 
            setProcessPageSQSMessageVisibilityTimeout(record.receiptHandle)
        ));

        const results = await handleProcessPageSQSMessages(event.Records, client);
        const totalRecords = event.Records.length;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Processed ${totalRecords} pages`,
                results,
            }),
        };
    } catch (error) {
        console.error('Error in processPageHandler:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to process pages',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
        if (pool) await pool.end();
    }
};
