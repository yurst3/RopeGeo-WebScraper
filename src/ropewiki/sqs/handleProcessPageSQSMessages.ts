import { PoolClient } from 'pg';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { processPage } from '../processors/processPage';
import RopewikiPage from '../types/page';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';
import deleteProcessPageSQSMessage from './deleteProcessPageSQSMessage';
import { timeoutAfter } from 'ropegeo-common/helpers/timeoutAfter';

/**
 * Handles processing of Ropewiki pages from SQS records.
 * Processes each record; on parse or processPage errors, logs and continues to the next message.
 * Stops starting new work when Lambda remaining time is below processPageTimeoutMs so the
 * invocation can finish and unprocessed messages become visible again for retry.
 *
 * @param records - Array of SQS records containing RopewikiPage data in each record's body
 * @param client - Database client (should be a PoolClient in a transaction)
 * @param lambdaTimeoutMs - Lambda timeout in ms (used to divide time across records)
 * @param getRemainingTimeInMillis - Callback returning remaining Lambda time in ms (e.g. from context.getRemainingTimeInMillis)
 * @returns Object containing the number of successes, errors, and remaining pages
 */
const handleProcessPageSQSMessages = async (
    records: SqsRecord[],
    client: PoolClient,
    lambdaTimeoutMs: number,
    getRemainingTimeInMillis: () => number,
): Promise<{ successes: number; errors: number; remaining: number }> => {
    const totalRecords = records.length;

    const logger = new ProgressLogger('Processing Ropewiki pages', totalRecords);
    logger.setChunk(0, totalRecords);

    await client.query('BEGIN');

    const processPageTimeoutMs = Math.floor(lambdaTimeoutMs / totalRecords);

    for (let i = 0; i < records.length; i++) {
        const remainingMs = getRemainingTimeInMillis();
        if (totalRecords > 1 && remainingMs < processPageTimeoutMs) {
            console.warn(
                `Stopping before message ${i + 1}/${totalRecords}: only ${remainingMs}ms remaining (need ${processPageTimeoutMs}ms to start a page). Unprocessed messages will retry.`,
            );
            break;
        }

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
            await timeoutAfter(processPageTimeoutMs, () =>
                processPage(client, page, logger, savepointName),
            );
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
