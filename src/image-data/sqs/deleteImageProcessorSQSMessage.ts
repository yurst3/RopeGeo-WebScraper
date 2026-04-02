import { deleteSQSMessage } from 'ropegeo-common/helpers';

/**
 * Deletes a message from the ImageProcessorQueue using its receipt handle.
 * If DEV_ENVIRONMENT is "local", skips deleting and logs instead.
 *
 * @param receiptHandle - The receipt handle of the message to delete
 * @throws Error if IMAGE_PROCESSOR_QUEUE_URL is not set
 */
const deleteImageProcessorSQSMessage = async (receiptHandle: string): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log('Skipping SQS message deletion - no queue configured locally');
        return;
    }

    const queueUrl = process.env.IMAGE_PROCESSOR_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('IMAGE_PROCESSOR_QUEUE_URL environment variable is not set');
    }

    await deleteSQSMessage(queueUrl, receiptHandle);
};

export default deleteImageProcessorSQSMessage;
