import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { main as processPageRouteAndMapData } from '../../map-data/main';
import { nodeSaveMapData } from '../../map-data/hook-functions/saveMapData';
import { PageDataSource } from '../../map-data/types/mapData';
import { Route } from '../../types/route';
import RopewikiPage from '../types/page';
import ProgressLogger from '../../helpers/progressLogger';

export type ProcessRopewikiRoutesHookFn = (routesAndPages: Array<[Route, RopewikiPage]>) => Promise<void>;

/**
 * Hook function for Node.js that processes routes directly by calling map-data processPageRouteAndMapData()
 * for each [Route, RopewikiPage] pair in a for-loop.
 * 
 * @param routesAndPages - Array of [Route, RopewikiPage] tuples to process
 */
export const nodeProcessRopewikiRoutes: ProcessRopewikiRoutesHookFn = async (
    routesAndPages: Array<[Route, RopewikiPage]>,
): Promise<void> => {
    if (routesAndPages.length === 0) {
        return;
    }

    const logger = new ProgressLogger('Processing map data for routes', routesAndPages.length);
    logger.setChunk(0, routesAndPages.length);

    for (const [route, page] of routesAndPages) {
        try {
            if (!route.id) {
                throw new Error('Route must have an id to process');
            }
            if (!page.id) {
                throw new Error('Page must have an id to process route');
            }
            
            await processPageRouteAndMapData(nodeSaveMapData, PageDataSource.Ropewiki, page.id, route.id);
            logger.logProgress(`Processed "${page.name}" (route ${route.id} / page ${page.id})`);
        } catch (error) {
            console.error(`Error processing route ${route.id || 'unknown'} / page ${page.id || 'unknown'}:`, error);
            // Skip this route/page pair and continue to the next one
            logger.logProgress(`Skipped "${page.name || 'unknown'}" (route ${route.id || 'unknown'} / page ${page.id || 'unknown'}) due to error`);
        }
    }
};

/**
 * Hook function for Lambda that sends SQS messages to MapDataProcessingQueue for each route/page.
 * If DEV_ENVIRONMENT is "local", skips sending messages and logs instead.
 * 
 * @param routesAndPages - Array of [Route, RopewikiPage] tuples to process
 */
export const lambdaProcessRopewikiRoutes: ProcessRopewikiRoutesHookFn = async (
    routesAndPages: Array<[Route, RopewikiPage]>,
): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    
    if (devEnvironment === 'local') {
        console.log(`Skipping SQS message sending for ${routesAndPages.length} route(s) - no queue configured locally`);
        return;
    }

    const queueUrl = process.env.MAP_DATA_PROCESSING_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set');
    }

    const sqsClient = new SQSClient({});
    
    // Send a message for each route/page pair
    for (const [route, page] of routesAndPages) {
        try {
            if (!route.id) {
                throw new Error('Route must have an id to send to queue');
            }
            if (!page.id) {
                throw new Error('Page must have an id to send to queue');
            }
            
            const messageBody = JSON.stringify({
                source: PageDataSource.Ropewiki,
                routeId: route.id,
                pageId: page.id,
            });
            
            const command = new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: messageBody,
            });
            
            await sqsClient.send(command);
            
            console.log(`Sent route ${route.id} / page ${page.id} to MapDataProcessingQueue`);
        } catch (error) {
            console.error(`Error sending route ${route.id || 'unknown'} / page ${page.id || 'unknown'} to queue:`, error);
            // Skip this route/page pair and continue to the next one
        }
    }
};
