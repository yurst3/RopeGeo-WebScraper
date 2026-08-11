import { PoolClient } from 'pg';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { ProgressLogger, timeoutAfter } from 'ropegeo-common/helpers';
import { main } from '../main';
import PageZipperJobEvent from '../types/pageZipperJobEvent';
import deletePageZipperSQSMessage from './deletePageZipperSQSMessage';
import setPageZipperSQSMessageVisibilityTimeout from './setPageZipperSQSMessageVisibilityTimeout';

const handlePageZipperSQSMessages = async (
    records: SqsRecord[],
    client: PoolClient,
    lambdaTimeoutMs: number,
    getRemainingTimeInMillis: () => number,
): Promise<{ successes: number; errors: number; remaining: number }> => {
    const totalRecords = records.length;
    const logger = new ProgressLogger('Processing page zipper jobs', totalRecords);
    logger.setChunk(0, totalRecords);

    const processMessageTimeoutMs = Math.floor(lambdaTimeoutMs / totalRecords);

    for (let i = 0; i < records.length; i++) {
        const remainingMs = getRemainingTimeInMillis();
        if (totalRecords > 1 && remainingMs < processMessageTimeoutMs) {
            console.warn(
                `Stopping before page zipper message ${i + 1}/${totalRecords}: only ${remainingMs}ms remaining (need ${processMessageTimeoutMs}ms). Unprocessed messages will retry.`,
            );
            break;
        }

        const record = records[i]!;
        let job: PageZipperJobEvent | undefined;

        try {
            job = PageZipperJobEvent.fromSQSEventRecord(record);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error parsing PageZipperJobEvent from SQS record: ${errorMessage}`);
            await deletePageZipperSQSMessage(record.receiptHandle);
            continue;
        }

        try {
            const result = await timeoutAfter(processMessageTimeoutMs, () =>
                main(job!, client),
            );

            if (result.status === 'not_ready') {
                // Leave the message for retry; visibility already set to processor timeout.
                console.warn(
                    `Page zipper job ${job.id} for page ${job.pageId} not ready; message will retry`,
                );
            } else {
                // complete | missing_job
                await deletePageZipperSQSMessage(record.receiptHandle);
                if (result.status === 'complete') {
                    logger.logProgress(`Processed page zipper job ${job.id}`);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(
                `Error processing page zipper job ${job.id} for page ${job.pageId}: ${errorMessage}`,
            );
        }
    }

    return logger.getResults();
};

export default handlePageZipperSQSMessages;
