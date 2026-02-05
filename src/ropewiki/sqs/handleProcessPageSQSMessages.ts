import { PoolClient } from 'pg';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { processPage } from '../processors/processPage';
import RopewikiPage from '../types/page';
import ProgressLogger from '../../helpers/progressLogger';
import deleteProcessPageSQSMessage from './deleteProcessPageSQSMessage';

/**
 * Handles processing of Ropewiki pages from SQS records.
 * Processes each record; on parse or processPage errors, logs and continues to the next message.
 *
 * @param records - Array of SQS records containing RopewikiPage data in each record's body
 * @param client - Database client (should be a PoolClient in a transaction)
 * @returns Object containing the number of successes, errors, and remaining pages
 */
const handleProcessPageSQSMessages = async (
    records: SqsRecord[],
    client: PoolClient,
): Promise<{ successes: number; errors: number; remaining: number }> => {
    const totalRecords = records.length;

    const logger = new ProgressLogger('Processing Ropewiki pages', totalRecords);
    logger.setChunk(0, totalRecords);

    await client.query('BEGIN');

    for (let i = 0; i < records.length; i++) {
        const record: SqsRecord = records[i]!;
        let page: RopewikiPage | undefined;

        try {
            page = RopewikiPage.fromSQSEventRecord(record);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error parsing Ropewiki Page from SQSEventRecord: ${errorMessage}`);
            await deleteProcessPageSQSMessage(record.receiptHandle);
            continue;
        }

        try {
            const savepointName = `sp_page_${i}`;
            await processPage(client, page, logger, savepointName);
            await deleteProcessPageSQSMessage(record.receiptHandle);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error processing page: ${errorMessage}`);
            // Don't delete message; it will become visible again for retry (or go to DLQ after max receives)
        }
    }

    await client.query('COMMIT');

    return logger.getResults();
};

export default handleProcessPageSQSMessages;
