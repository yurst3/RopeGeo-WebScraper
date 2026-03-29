import { PoolClient } from 'pg';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { main } from '../main';
import { lambdaSaveImageData } from '../hook-functions/saveImageData';
import { ImageDataEvent } from '../types/lambdaEvent';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';
import deleteImageProcessorSQSMessage from './deleteImageProcessorSQSMessage';
import { timeoutAfter } from 'ropegeo-common/helpers/timeoutAfter';

/**
 * Handles processing of image data from SQS records.
 * Processes each record; on success or conversion failure (ImageData with errorMessage)
 * we upsert ImageData, set processedImage, and delete the message. On HTTP/download
 * failure we throw so the message is not deleted and can retry / go to DLQ.
 */
const handleImageProcessorSQSMessages = async (
    records: SqsRecord[],
    client: PoolClient,
    lambdaTimeoutMs: number,
    getRemainingTimeInMillis: () => number,
): Promise<{ successes: number; errors: number; remaining: number }> => {
    const totalRecords = records.length;
    const logger = new ProgressLogger('Processing image data', totalRecords);
    logger.setChunk(0, totalRecords);

    const processMessageTimeoutMs = Math.floor(lambdaTimeoutMs / totalRecords);

    for (let i = 0; i < records.length; i++) {
        const remainingMs = getRemainingTimeInMillis();
        if (totalRecords > 1 && remainingMs < processMessageTimeoutMs) {
            console.warn(
                `Stopping before message ${i + 1}/${totalRecords}: only ${remainingMs}ms remaining. Unprocessed messages will retry.`,
            );
            break;
        }

        const record = records[i]!;
        let event: ImageDataEvent | undefined;

        try {
            event = ImageDataEvent.fromSQSEventRecord(record);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error parsing ImageDataEvent: ${errorMessage}`);
            await deleteImageProcessorSQSMessage(record.receiptHandle);
            continue;
        }

        try {
            await timeoutAfter(processMessageTimeoutMs, (abortSignal) =>
                main(event!, lambdaSaveImageData, logger, client, abortSignal),
            );
            await deleteImageProcessorSQSMessage(record.receiptHandle);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(
                `Error processing image for ${event!.pageDataSource} pageImageId ${event!.pageImageId}: ${errorMessage}`,
            );
            // Do not delete message; it will become visible again for retry or go to DLQ
        }
    }

    return logger.getResults();
};

export default handleImageProcessorSQSMessages;
