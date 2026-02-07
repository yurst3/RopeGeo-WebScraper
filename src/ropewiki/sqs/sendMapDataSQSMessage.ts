import sendSQSMessage from '../../helpers/sqs/sendSQSMessage';
import type { RopewikiRoute } from '../../types/pageRoute';

/**
 * Sends a single RopewikiRoute to the MapDataProcessingQueue.
 * If DEV_ENVIRONMENT is "local", returns without sending.
 * When not local, validates that the route has page and route, and MAP_DATA_PROCESSING_QUEUE_URL is set,
 * then sends the message with body (JSON map data event).
 *
 * @param ropewikiRoute - The RopewikiRoute to send (must have page and route)
 * @throws Error if not local and ropewikiRoute.page is missing
 * @throws Error if not local and ropewikiRoute.route is missing
 * @throws Error if not local and MAP_DATA_PROCESSING_QUEUE_URL is not set
 */
const sendMapDataSQSMessage = async (ropewikiRoute: RopewikiRoute): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log(
            `Skipping SQS message sending for route ${ropewikiRoute.route ?? 'unknown'} / page ${ropewikiRoute.page ?? 'unknown'} - no queue configured locally`,
        );
        return;
    }

    if (ropewikiRoute.route === undefined || ropewikiRoute.route === null || ropewikiRoute.route === '') {
        throw new Error('RopewikiRoute must have a route to send to queue');
    }

    if (ropewikiRoute.page === undefined || ropewikiRoute.page === null || ropewikiRoute.page === '') {
        throw new Error('RopewikiRoute must have a page to send to queue');
    }

    const queueUrl = process.env.MAP_DATA_PROCESSING_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set');
    }

    const mapDataEvent = ropewikiRoute.toMapDataEvent();
    await sendSQSMessage(JSON.stringify(mapDataEvent), queueUrl);
};

export default sendMapDataSQSMessage;
