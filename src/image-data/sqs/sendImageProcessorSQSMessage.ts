import sendSQSMessage from 'ropegeo-common/helpers/sqs/sendSQSMessage';
import type { ImageDataEvent } from '../types/lambdaEvent';

/**
 * JSON body written to the ImageProcessor SQS queue (same shape as {@link ImageDataEvent.fromSQSEventRecord} input).
 */
export function serializeImageDataEventForQueue(event: ImageDataEvent): string {
    return JSON.stringify({
        pageDataSource: event.pageDataSource,
        pageImageId: event.pageImageId,
        sourceUrl: event.sourceUrl,
        downloadSource: event.downloadSource,
        existingProcessedImageId: event.existingProcessedImageId,
        ...(event.versions != null && { versions: event.versions }),
    });
}

/**
 * Sends an ImageDataEvent to the ImageProcessorQueue.
 * If DEV_ENVIRONMENT is "local", returns without sending.
 *
 * @param event - The ImageDataEvent to send
 * @throws Error if not local and IMAGE_PROCESSOR_QUEUE_URL is not set
 */
const sendImageProcessorSQSMessage = async (event: ImageDataEvent): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log(
            `Skipping SQS message sending for image ${event.pageImageId} (${event.pageDataSource}) - no queue configured locally`,
        );
        return;
    }

    const queueUrl = process.env.IMAGE_PROCESSOR_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('IMAGE_PROCESSOR_QUEUE_URL environment variable is not set');
    }

    const body = serializeImageDataEventForQueue(event);
    await sendSQSMessage(body, queueUrl);
};

export default sendImageProcessorSQSMessage;
