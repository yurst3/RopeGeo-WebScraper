import { deleteSQSMessage } from 'ropegeo-common/helpers';

const deleteRelevanceSQSMessage = async (receiptHandle: string): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    if (devEnvironment === 'local') {
        console.log('Skipping relevance SQS message deletion - no queue configured locally');
        return;
    }

    const queueUrl = process.env.MAP_DATA_RELEVANCE_QUEUE_URL;
    if (queueUrl == null || queueUrl.trim().length === 0) {
        throw new Error('MAP_DATA_RELEVANCE_QUEUE_URL environment variable is not set');
    }

    await deleteSQSMessage(queueUrl, receiptHandle);
};

export default deleteRelevanceSQSMessage;
