import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { getSQSClient } from 'ropegeo-common/helpers';

export type FifoSQSMessageParams = {
    body: string;
    queueUrl: string;
    messageGroupId: string;
    messageDeduplicationId: string;
};

const sendFifoSQSMessage = async ({
    body,
    queueUrl,
    messageGroupId,
    messageDeduplicationId,
}: FifoSQSMessageParams): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    if (devEnvironment === 'local') {
        console.log('Skipping FIFO SQS message send - no queue configured locally');
        return;
    }

    const sqsClient = getSQSClient();
    await sqsClient.send(
        new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: body,
            MessageGroupId: messageGroupId,
            MessageDeduplicationId: messageDeduplicationId,
        }),
    );
};

export default sendFifoSQSMessage;
