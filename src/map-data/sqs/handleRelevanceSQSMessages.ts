import { PoolClient } from 'pg';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { ProgressLogger, timeoutAfter } from 'ropegeo-common/helpers';
import processRelevanceJob from '../processors/processRelevanceJob';
import RelevanceJobEvent from '../types/relevanceJobEvent';
import { getRelevanceErrorRetryVisibilityTimeoutSeconds } from '../util/getRelevanceErrorRetryVisibilityTimeoutSeconds';
import deleteRelevanceSQSMessage from './deleteRelevanceSQSMessage';
import setRelevanceSQSMessageVisibilityTimeout from './setRelevanceSQSMessageVisibilityTimeout';

const handleRelevanceSQSMessages = async (
    records: SqsRecord[],
    client: PoolClient,
    lambdaTimeoutMs: number,
    getRemainingTimeInMillis: () => number,
): Promise<{ successes: number; errors: number; remaining: number }> => {
    const totalRecords = records.length;
    const logger = new ProgressLogger('Processing map data relevance jobs', totalRecords);
    logger.setChunk(0, totalRecords);

    const processMessageTimeoutMs = Math.floor(lambdaTimeoutMs / totalRecords);

    for (let i = 0; i < records.length; i++) {
        const remainingMs = getRemainingTimeInMillis();
        if (totalRecords > 1 && remainingMs < processMessageTimeoutMs) {
            console.warn(
                `Stopping before relevance message ${i + 1}/${totalRecords}: only ${remainingMs}ms remaining (need ${processMessageTimeoutMs}ms). Unprocessed messages will retry.`,
            );
            break;
        }

        const record = records[i]!;
        let job: RelevanceJobEvent | undefined;

        try {
            job = RelevanceJobEvent.fromSQSEventRecord(record);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error parsing RelevanceJobEvent from SQS record: ${errorMessage}`);
            await deleteRelevanceSQSMessage(record.receiptHandle);
            continue;
        }

        try {
            const result = await timeoutAfter(processMessageTimeoutMs, () =>
                processRelevanceJob(
                    client,
                    job!,
                    logger,
                    getRemainingTimeInMillis,
                    lambdaTimeoutMs,
                ),
            );

            if (result.status === 'partial') {
                await setRelevanceSQSMessageVisibilityTimeout(record.receiptHandle, 0);
                console.log(
                    `Requeued relevance job ${job.id} (visibility 0); ${result.remainingCount} legend items remaining`,
                );
            } else if (result.status === 'failed') {
                const retryVisibilitySeconds = getRelevanceErrorRetryVisibilityTimeoutSeconds();
                await setRelevanceSQSMessageVisibilityTimeout(
                    record.receiptHandle,
                    retryVisibilitySeconds,
                );
                console.log(
                    `Deferred relevance job ${job.id} for ${retryVisibilitySeconds}s after ${result.errors.length} error(s)`,
                );
            } else {
                // complete | missing_job
                await deleteRelevanceSQSMessage(record.receiptHandle);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(
                `Error processing relevance job ${job.id} for page ${job.pageId}: ${errorMessage}`,
            );
        }
    }

    return logger.getResults();
};

export default handleRelevanceSQSMessages;
