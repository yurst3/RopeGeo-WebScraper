import { DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { getSQSClient } from './getSQSClient';

const isRetryableSQSError = (error: unknown): boolean => {
    const code = (error as NodeJS.ErrnoException)?.code;
    const errno = (error as NodeJS.ErrnoException)?.errno;
    if (code === 'EBUSY' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENETUNREACH') {
        return true;
    }
    if (typeof errno === 'number' && (errno === -16 || errno === -105 || errno === -110)) {
        return true;
    }
    return false;
};

/**
 * Deletes a message from an SQS queue using its receipt handle, with retries on transient errors.
 * If DEV_ENVIRONMENT is "local", skips deleting and logs instead.
 *
 * @param queueUrl - The URL of the SQS queue
 * @param receiptHandle - The receipt handle of the message to delete
 * @param retries - Number of retry attempts on transient errors (default 5)
 */
const deleteSQSMessage = async (queueUrl: string, receiptHandle: string, retries = 5): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log('Skipping SQS message deletion - no queue configured locally');
        return;
    }

    const sqsClient = getSQSClient();

    const command = new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
    });

    const maxAttempts = retries + 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            await sqsClient.send(command);
            return;
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts - 1 && isRetryableSQSError(error)) {
                const delayMs = 100 * Math.pow(2, attempt);
                console.warn(`SQS delete retry ${attempt + 1}/${retries}: ${(error as Error).message}`);
                await new Promise((r) => setTimeout(r, delayMs));
            } else {
                throw error;
            }
        }
    }
    throw lastError;
};

export default deleteSQSMessage;
