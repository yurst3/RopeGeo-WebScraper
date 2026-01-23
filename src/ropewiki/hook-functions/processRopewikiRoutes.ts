import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { main as processPageRouteAndMapData } from '../../map-data/main';
import { nodeSaveMapData } from '../../map-data/hook-functions/saveMapData';
import { RopewikiRoute } from '../../types/pageRoute';
import ProgressLogger from '../../helpers/progressLogger';

export type ProcessRopewikiRoutesHookFn = (ropewikiRoutes: RopewikiRoute[]) => Promise<void>;

/**
 * Hook function for Node.js that processes routes directly by calling map-data processPageRouteAndMapData()
 * for each RopewikiRoute in a for-loop.
 * 
 * @param ropewikiRoutes - Array of RopewikiRoute objects to process
 */
export const nodeProcessRopewikiRoutes: ProcessRopewikiRoutesHookFn = async (
    ropewikiRoutes: RopewikiRoute[],
): Promise<void> => {
    if (ropewikiRoutes.length === 0) {
        return;
    }

    const logger = new ProgressLogger('Processing map data for routes', ropewikiRoutes.length);
    logger.setChunk(0, ropewikiRoutes.length);

    for (const ropewikiRoute of ropewikiRoutes) {
        try {
            if (!ropewikiRoute.route) {
                throw new Error('RopewikiRoute must have a route id to process');
            }
            if (!ropewikiRoute.page) {
                throw new Error('RopewikiRoute must have a page id to process');
            }
            
            const mapDataEvent = ropewikiRoute.toMapDataEvent();
            await processPageRouteAndMapData(nodeSaveMapData, mapDataEvent);
            logger.logProgress(`Processed route ${ropewikiRoute.route} / page ${ropewikiRoute.page}`);
        } catch (error) {
            console.error(`Error processing route ${ropewikiRoute.route || 'unknown'} / page ${ropewikiRoute.page || 'unknown'}:`, error);
            // Skip this route and continue to the next one
            logger.logProgress(`Skipped route ${ropewikiRoute.route || 'unknown'} / page ${ropewikiRoute.page || 'unknown'} due to error`);
        }
    }
};

/**
 * Hook function for Lambda that sends SQS messages to MapDataProcessingQueue for each route.
 * If DEV_ENVIRONMENT is "local", skips sending messages and logs instead.
 * 
 * @param ropewikiRoutes - Array of RopewikiRoute objects to process
 */
export const lambdaProcessRopewikiRoutes: ProcessRopewikiRoutesHookFn = async (
    ropewikiRoutes: RopewikiRoute[],
): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    
    if (devEnvironment === 'local') {
        console.log(`Skipping SQS message sending for ${ropewikiRoutes.length} route(s) - no queue configured locally`);
        return;
    }

    const queueUrl = process.env.MAP_DATA_PROCESSING_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set');
    }

    const sqsClient = new SQSClient({});
    
    // Send a message for each route
    for (const ropewikiRoute of ropewikiRoutes) {
        try {
            if (!ropewikiRoute.route) {
                throw new Error('RopewikiRoute must have a route id to send to queue');
            }
            if (!ropewikiRoute.page) {
                throw new Error('RopewikiRoute must have a page id to send to queue');
            }
            
            const mapDataEvent = ropewikiRoute.toMapDataEvent();
            const messageBody = JSON.stringify({
                source: mapDataEvent.source,
                routeId: mapDataEvent.routeId,
                pageId: mapDataEvent.pageId,
                mapDataId: mapDataEvent.mapDataId,
            });
            
            const command = new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: messageBody,
            });
            
            await sqsClient.send(command);
            
            console.log(`Sent route ${ropewikiRoute.route} / page ${ropewikiRoute.page} to MapDataProcessingQueue`);
        } catch (error) {
            console.error(`Error sending route ${ropewikiRoute.route || 'unknown'} / page ${ropewikiRoute.page || 'unknown'} to queue:`, error);
            // Skip this route and continue to the next one
        }
    }
};
