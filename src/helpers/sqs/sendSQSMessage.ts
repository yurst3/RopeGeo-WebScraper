import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Sends a message to an SQS queue.
 * If DEV_ENVIRONMENT is "local", skips sending and logs instead.
 *
 * @param body - The message body (string)
 * @param queueUrl - The URL of the SQS queue
 * @param attributes - Optional message attributes (string key-value pairs; converted to SQS MessageAttributes)
 */
const sendSQSMessage = async (
    body: string,
    queueUrl: string,
    attributes?: Record<string, string>,
): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log('Skipping SQS message send - no queue configured locally');
        return;
    }

    const sqsClient = new SQSClient({});

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

    await sqsClient.send(command);
};

export default sendSQSMessage;
