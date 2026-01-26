import changeSQSMessageVisibilityTimeout from '../../helpers/sqs/changeSQSMessageVisibilityTimeout';

/**
 * Sets the visibility timeout for a message in the MapDataProcessingQueue.
 * This allows delaying the message's return to the queue for retry purposes.
 * If DEV_ENVIRONMENT is "local", skips setting the visibility timeout and logs instead.
 * 
 * @param receiptHandle - The receipt handle of the message
 * @param retryInSeconds - The visibility timeout in seconds (must be between 0 and 43200)
 * @throws Error if retryInSeconds is not between 0 and 43200
 * @throws Error if MAP_DATA_PROCESSING_QUEUE_URL is not set
 */
const setMapDataSQSMessageRetryTime = async (
    receiptHandle: string,
    retryInSeconds: number,
): Promise<void> => {
    const queueUrl = process.env.MAP_DATA_PROCESSING_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set');
    }

    await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, retryInSeconds);
};

export default setMapDataSQSMessageRetryTime;
