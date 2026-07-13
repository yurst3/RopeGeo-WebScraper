import {
    ChangeMessageVisibilityCommand,
    ReceiveMessageCommand,
} from '@aws-sdk/client-sqs';
import { getSQSClient } from 'ropegeo-common/helpers';

const DLQ_PEEK_BATCH_SIZE = 10;
const DLQ_PEEK_VISIBILITY_SECONDS = 5;

const findRelevanceJobInDlq = async (jobId: string): Promise<boolean> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    if (devEnvironment === 'local') {
        return false;
    }

    const dlqUrl = process.env.MAP_DATA_RELEVANCE_DLQ_URL;
    if (dlqUrl == null || dlqUrl.trim().length === 0) {
        throw new Error('MAP_DATA_RELEVANCE_DLQ_URL environment variable is not set');
    }

    const sqsClient = getSQSClient();
    const response = await sqsClient.send(
        new ReceiveMessageCommand({
            QueueUrl: dlqUrl,
            MaxNumberOfMessages: DLQ_PEEK_BATCH_SIZE,
            WaitTimeSeconds: 0,
            VisibilityTimeout: DLQ_PEEK_VISIBILITY_SECONDS,
            MessageAttributeNames: ['All'],
        }),
    );

    const messages = response.Messages ?? [];
    let found = false;

    for (const message of messages) {
        if (message.ReceiptHandle == null) continue;

        let bodyJobId: string | undefined;
        try {
            const parsed = JSON.parse(message.Body ?? '{}') as { id?: string };
            bodyJobId = parsed.id;
        } catch {
            bodyJobId = undefined;
        }

        if (bodyJobId === jobId) {
            found = true;
        }

        await sqsClient.send(
            new ChangeMessageVisibilityCommand({
                QueueUrl: dlqUrl,
                ReceiptHandle: message.ReceiptHandle,
                VisibilityTimeout: 0,
            }),
        );
    }

    return found;
};

export default findRelevanceJobInDlq;
