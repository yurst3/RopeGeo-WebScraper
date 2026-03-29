import sendSQSMessage from 'ropegeo-common/helpers/sqs/sendSQSMessage';
import RopewikiPage from '../types/page';

/**
 * Sends a single RopewikiPage to the RopewikiPageProcessingQueue.
 * If DEV_ENVIRONMENT is "local", returns without sending.
 * When not local, validates that the page has an id and ROPEWIKI_PAGE_PROCESSING_QUEUE_URL is set, then sends the message with body (JSON page).
 *
 * @param page - The RopewikiPage to send
 * @throws Error if not local and page.id is undefined
 * @throws Error if not local and ROPEWIKI_PAGE_PROCESSING_QUEUE_URL is not set
 */
const sendProcessPageSQSMessage = async (page: RopewikiPage): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log(`Skipping SQS message sending for page ${page.name} - no queue configured locally`);
        return;
    }

    if (page.id === undefined || page.id === null) {
        throw new Error('RopewikiPage must have an id to send to queue');
    }

    const queueUrl = process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set');
    }

    await sendSQSMessage(JSON.stringify(page), queueUrl);
};

export default sendProcessPageSQSMessage;
