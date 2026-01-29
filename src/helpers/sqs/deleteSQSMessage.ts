import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Deletes a message from an SQS queue using its receipt handle.
 * If DEV_ENVIRONMENT is "local", skips deleting the message and logs instead.
 * 
 * @param queueUrl - The URL of the SQS queue
 * @param receiptHandle - The receipt handle of the message to delete
 */
const deleteSQSMessage = async (queueUrl: string, receiptHandle: string): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    
    if (devEnvironment === 'local') {
        console.log('Skipping SQS message deletion - no queue configured locally');
        return;
    }

    const sqsClient = new SQSClient({});
    
    const command = new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
    });
    
    await sqsClient.send(command);
};

export default deleteSQSMessage;
