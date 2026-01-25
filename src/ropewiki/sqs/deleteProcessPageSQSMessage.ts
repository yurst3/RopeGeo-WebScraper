import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Deletes a message from the RopewikiPageProcessingQueue using its receipt handle.
 * If DEV_ENVIRONMENT is "local", skips deleting the message and logs instead.
 * 
 * @param receiptHandle - The receipt handle of the message to delete
 */
const deleteProcessPageSQSMessage = async (receiptHandle: string): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    
    if (devEnvironment === 'local') {
        console.log('Skipping SQS message deletion - no queue configured locally');
        return;
    }

    const queueUrl = process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set');
    }

    const sqsClient = new SQSClient({});
    
    const command = new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
    });
    
    await sqsClient.send(command);
};

export default deleteProcessPageSQSMessage;
