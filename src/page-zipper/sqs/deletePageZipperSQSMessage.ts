import { deleteSQSMessage } from 'ropegeo-common/helpers';

const deletePageZipperSQSMessage = async (receiptHandle: string): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    if (devEnvironment === 'local') {
        console.log('Skipping page zipper SQS message deletion - no queue configured locally');
        return;
    }

    const queueUrl = process.env.PAGE_ZIPPER_QUEUE_URL;
    if (queueUrl == null || queueUrl.trim().length === 0) {
        throw new Error('PAGE_ZIPPER_QUEUE_URL environment variable is not set');
    }

    await deleteSQSMessage(queueUrl, receiptHandle);
};

export default deletePageZipperSQSMessage;
