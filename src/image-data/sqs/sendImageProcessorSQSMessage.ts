import sendSQSMessage from '../../helpers/sqs/sendSQSMessage';
import type { ImageDataEvent } from '../types/lambdaEvent';

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
            `Skipping SQS message sending for image ${event.id} (${event.pageDataSource}) - no queue configured locally`,
        );
        return;
    }

    const queueUrl = process.env.IMAGE_PROCESSOR_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('IMAGE_PROCESSOR_QUEUE_URL environment variable is not set');
    }

    const body = JSON.stringify({
        pageDataSource: event.pageDataSource,
        id: event.id,
        source: event.source,
    });
    await sendSQSMessage(body, queueUrl);
};

export default sendImageProcessorSQSMessage;
