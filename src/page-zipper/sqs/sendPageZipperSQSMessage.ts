import sendFifoSQSMessage from '../../map-data/sqs/sendFifoSQSMessage';
import type { PageZipperJobMessage } from '../types/pageZipperJob';

const sendPageZipperSQSMessage = async (message: PageZipperJobMessage): Promise<void> => {
    const queueUrl = process.env.PAGE_ZIPPER_QUEUE_URL;
    if (queueUrl == null || queueUrl.trim().length === 0) {
        throw new Error('PAGE_ZIPPER_QUEUE_URL environment variable is not set');
    }

    await sendFifoSQSMessage({
        body: JSON.stringify(message),
        queueUrl,
        messageGroupId: message.pageId,
        messageDeduplicationId: message.id,
    });
};

export default sendPageZipperSQSMessage;
