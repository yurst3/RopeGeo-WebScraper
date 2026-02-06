import { SendMessageCommand } from '@aws-sdk/client-sqs';
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
 * Sends a message to an SQS queue with retries on transient errors (e.g. EBUSY, timeout).
 * If DEV_ENVIRONMENT is "local", skips sending and logs instead.
 *
 * @param body - The message body (string)
 * @param queueUrl - The URL of the SQS queue
 * @param attributes - Optional message attributes (string key-value pairs; converted to SQS MessageAttributes)
 * @param retries - Number of retry attempts on transient errors (default 5)
 */
const sendSQSMessage = async (
    body: string,
    queueUrl: string,
    attributes?: Record<string, string>,
    retries = 5,
): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log('Skipping SQS message send - no queue configured locally');
        return;
    }

    const sqsClient = getSQSClient();

    const messageAttributes =
        attributes && Object.keys(attributes).length > 0
            ? Object.fromEntries(
                  Object.entries(attributes).map(([key, value]) => [
                      key,
                      { DataType: 'String' as const, StringValue: value },
                  ]),
              )
            : undefined;

    const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: body,
        ...(messageAttributes ? { MessageAttributes: messageAttributes } : {}),
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
                console.warn(`SQS send retry ${attempt + 1}/${retries}: ${(error as Error).message}`);
                await new Promise((r) => setTimeout(r, delayMs));
            } else {
                throw error;
            }
        }
    }
    throw lastError;
};

export default sendSQSMessage;
