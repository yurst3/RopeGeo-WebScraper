import { Pool } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import { processPage } from '../processors/processPage';
import RopewikiPageInfo from '../types/ropewiki';
import type { SqsEvent } from '@aws-lambda-powertools/parser/types';

/**
 * Lambda handler for processing a single Ropewiki page.
 * Expects an SQS event with Records array containing the RopewikiPageInfo in the body.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const processPageHandler = async (event: SqsEvent, context: any) => {
    const pool = await getDatabaseConnection();
    const client = await pool.connect();

    try {
        // Validate SQS event format
        if (!event.Records || !Array.isArray(event.Records) || event.Records.length === 0) {
            throw new Error('Invalid SQS event: missing Records array or empty Records');
        }

        // Process the first record (BatchSize is 1, so there should only be one)
        const record = event.Records[0]!;
        const page = RopewikiPageInfo.fromSQSEventRecord(record);

        // Begin transaction
        await client.query('BEGIN');
        
        // Process the single page
        await processPage(client, page);

        // Commit transaction
        await client.query('COMMIT');

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Page processed successfully',
                pageId: page.pageid,
            }),
        };
    } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK').catch(() => {
            // Ignore rollback errors if transaction was already rolled back
        });
        
        console.error('Error processing page:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to process page',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        client.release();
        await pool.end();
    }
};
