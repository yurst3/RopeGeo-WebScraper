import sendFifoSQSMessage from './sendFifoSQSMessage';

export type RelevanceJobMessage = {
    id: string;
    mapDataId: string;
    pageId: string;
    pageSource: string;
};

const sendRelevanceSQSMessage = async (message: RelevanceJobMessage): Promise<void> => {
    const queueUrl = process.env.MAP_DATA_RELEVANCE_QUEUE_URL;
    if (queueUrl == null || queueUrl.trim().length === 0) {
        throw new Error('MAP_DATA_RELEVANCE_QUEUE_URL environment variable is not set');
    }

    await sendFifoSQSMessage({
        body: JSON.stringify(message),
        queueUrl,
        messageGroupId: message.pageId,
        messageDeduplicationId: message.id,
    });
};

export default sendRelevanceSQSMessage;
