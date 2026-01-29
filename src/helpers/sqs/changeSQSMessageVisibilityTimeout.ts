import { SQSClient, ChangeMessageVisibilityCommand } from '@aws-sdk/client-sqs';

/**
 * Sets the visibility timeout for a message in an SQS queue.
 * This allows delaying the message's return to the queue for retry purposes.
 * If DEV_ENVIRONMENT is "local", skips setting the visibility timeout and logs instead.
 * 
 * @param queueUrl - The URL of the SQS queue
 * @param receiptHandle - The receipt handle of the message
 * @param retryInSeconds - The visibility timeout in seconds (must be between 0 and 43200)
 * @throws Error if retryInSeconds is not between 0 and 43200
 */
const changeSQSMessageVisibilityTimeout = async (
    queueUrl: string,
    receiptHandle: string,
    retryInSeconds: number,
): Promise<void> => {
    // Validate retryInSeconds is within allowed range
    if (retryInSeconds < 0 || retryInSeconds > 43200) {
        throw new Error(`retryInSeconds must be between 0 and 43200, got ${retryInSeconds}`);
    }

    const devEnvironment = process.env.DEV_ENVIRONMENT;
    
    if (devEnvironment === 'local') {
        console.log('Skipping SQS message visibility timeout change - no queue configured locally');
        return;
    }

    const sqsClient = new SQSClient({});
    
    const command = new ChangeMessageVisibilityCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: retryInSeconds,
    });
    
    await sqsClient.send(command);
};

export default changeSQSMessageVisibilityTimeout;
