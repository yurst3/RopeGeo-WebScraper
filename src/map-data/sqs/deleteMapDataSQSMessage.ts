import { deleteSQSMessage } from 'ropegeo-common/helpers';

/**
 * Deletes a message from the MapDataProcessingQueue using its receipt handle.
 * If DEV_ENVIRONMENT is "local", skips deleting the message and logs instead.
 * 
 * @param receiptHandle - The receipt handle of the message to delete
 * @throws Error if MAP_DATA_PROCESSING_QUEUE_URL is not set
 */
const deleteMapDataSQSMessage = async (receiptHandle: string): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    
    if (devEnvironment === 'local') {
        console.log('Skipping SQS message deletion - no queue configured locally');
        return;
    }

    const queueUrl = process.env.MAP_DATA_PROCESSING_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set');
    }

    await deleteSQSMessage(queueUrl, receiptHandle);
};

export default deleteMapDataSQSMessage;
