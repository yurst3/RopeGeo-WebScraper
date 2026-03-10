import {
    ReceiveMessageCommand,
    DeleteMessageCommand,
    SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { getSQSClient } from '../../helpers/sqs/getSQSClient';

const MAX_MESSAGES_PER_RUN = 10;
const WAIT_TIME_SECONDS = 1;

/**
 * Lambda invoked on a schedule (e.g. every 24h). Receives messages from the
 * ImageProcessor DLQ, sends each body to the main ImageProcessorQueue, then
 * deletes from the DLQ.
 */
export const dlqRequeueHandler = async (): Promise<{ requeued: number; errors: number }> => {
    const dlqUrl = process.env.IMAGE_PROCESSOR_DLQ_URL;
    const mainQueueUrl = process.env.IMAGE_PROCESSOR_QUEUE_URL;
    if (!dlqUrl || !mainQueueUrl) {
        throw new Error(
            'IMAGE_PROCESSOR_DLQ_URL and IMAGE_PROCESSOR_QUEUE_URL must be set',
        );
    }

    const sqs = getSQSClient();
    let requeued = 0;
    let errors = 0;

    const receiveResult = await sqs.send(
        new ReceiveMessageCommand({
            QueueUrl: dlqUrl,
            MaxNumberOfMessages: MAX_MESSAGES_PER_RUN,
            WaitTimeSeconds: WAIT_TIME_SECONDS,
            VisibilityTimeout: 30,
        }),
    );

    const messages = receiveResult.Messages ?? [];
    for (const msg of messages) {
        const body = msg.Body;
        const receiptHandle = msg.ReceiptHandle;
        if (!body || !receiptHandle) {
            errors += 1;
            continue;
        }
        try {
            await sqs.send(
                new SendMessageCommand({
                    QueueUrl: mainQueueUrl,
                    MessageBody: body,
                }),
            );
            await sqs.send(
                new DeleteMessageCommand({
                    QueueUrl: dlqUrl,
                    ReceiptHandle: receiptHandle,
                }),
            );
            requeued += 1;
        } catch (err) {
            console.error('Failed to requeue or delete message:', err);
            errors += 1;
        }
    }

    if (requeued > 0 || messages.length > 0) {
        console.log(
            `ImageProcessor DLQ requeue: ${requeued} sent to main queue, ${errors} errors, ${messages.length} received`,
        );
    }
    return { requeued, errors };
};
