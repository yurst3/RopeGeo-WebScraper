import { PurgeQueueCommand } from '@aws-sdk/client-sqs';
import { getSQSClient } from 'ropegeo-common/helpers';

async function purgeQueue(queueUrl: string, label: string): Promise<void> {
    const sqsClient = getSQSClient();
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
    console.log(`Purged ${label}: ${queueUrl}`);
}

/**
 * Flushes PageZipperQueue and its DLQ.
 * Skips when DEV_ENVIRONMENT is local (no queues configured).
 */
const purgePageZipperQueues = async (): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    if (devEnvironment === 'local') {
        console.log('Skipping page zipper queue purge - no queues configured locally');
        return;
    }

    const queueUrl = process.env.PAGE_ZIPPER_QUEUE_URL;
    if (queueUrl == null || queueUrl.trim().length === 0) {
        throw new Error('PAGE_ZIPPER_QUEUE_URL environment variable is not set');
    }

    const dlqUrl = process.env.PAGE_ZIPPER_DLQ_URL;
    if (dlqUrl == null || dlqUrl.trim().length === 0) {
        throw new Error('PAGE_ZIPPER_DLQ_URL environment variable is not set');
    }

    await purgeQueue(queueUrl, 'PageZipperQueue');
    await purgeQueue(dlqUrl, 'PageZipperDLQ');
};

export default purgePageZipperQueues;
