import { PurgeQueueCommand } from '@aws-sdk/client-sqs';
import { getSQSClient } from 'ropegeo-common/helpers';

async function purgeQueue(queueUrl: string, label: string): Promise<void> {
    const sqsClient = getSQSClient();
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
    console.log(`Purged ${label}: ${queueUrl}`);
}

/**
 * Flushes MapDataRelevanceProcessingQueue and its DLQ.
 * Skips when DEV_ENVIRONMENT is local (no queues configured).
 */
const purgeRelevanceQueues = async (): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    if (devEnvironment === 'local') {
        console.log('Skipping relevance queue purge - no queues configured locally');
        return;
    }

    const queueUrl = process.env.MAP_DATA_RELEVANCE_QUEUE_URL;
    if (queueUrl == null || queueUrl.trim().length === 0) {
        throw new Error('MAP_DATA_RELEVANCE_QUEUE_URL environment variable is not set');
    }

    const dlqUrl = process.env.MAP_DATA_RELEVANCE_DLQ_URL;
    if (dlqUrl == null || dlqUrl.trim().length === 0) {
        throw new Error('MAP_DATA_RELEVANCE_DLQ_URL environment variable is not set');
    }

    await purgeQueue(queueUrl, 'MapDataRelevanceProcessingQueue');
    await purgeQueue(dlqUrl, 'MapDataRelevanceProcessingDLQ');
};

export default purgeRelevanceQueues;
