import { main as processPageRouteAndMapData } from '../../map-data/main';
import { nodeSaveMapData } from '../../map-data/hook-functions/saveMapData';
import { RopewikiRoute } from '../../types/pageRoute';
import ProgressLogger from '../../helpers/progressLogger';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import sendMapDataSQSMessage from '../sqs/sendMapDataSQSMessage';

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

    const pool = await getDatabaseConnection();
    const client = await pool.connect();

    try {
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
                await processPageRouteAndMapData(mapDataEvent, nodeSaveMapData, logger, client);
                // Note: The hook function (nodeSaveMapData) will log progress/errors for map data processing
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.logError(`Error processing route ${ropewikiRoute.route || 'unknown'} / page ${ropewikiRoute.page || 'unknown'}: ${errorMessage}`);
                // Skip this route and continue to the next one
            }
        }
    } finally {
        client.release();
        await pool.end();
    }
};

/**
 * Hook function for Lambda that sends SQS messages to MapDataProcessingQueue for each route.
 * If DEV_ENVIRONMENT is "local", skips sending messages and logs instead.
 * Errors propagate (fail fast); use sendMapDataSQSMessage for validation and sending.
 * Uses a ProgressLogger to log progress of sending messages.
 *
 * @param ropewikiRoutes - Array of RopewikiRoute objects to process
 */
export const lambdaProcessRopewikiRoutes: ProcessRopewikiRoutesHookFn = async (
    ropewikiRoutes: RopewikiRoute[],
): Promise<void> => {
    if (ropewikiRoutes.length === 0) {
        return;
    }

    if (process.env.DEV_ENVIRONMENT === 'local') {
        console.log(`Skipping SQS message sending for ${ropewikiRoutes.length} route(s) - no queue configured locally`);
        return;
    }

    const logger = new ProgressLogger('Queueing RopewikiRoutes to map data queue', ropewikiRoutes.length);
    logger.setChunk(0, ropewikiRoutes.length);

    for (const ropewikiRoute of ropewikiRoutes) {
        await sendMapDataSQSMessage(ropewikiRoute);
        logger.logProgress(`Sent route ${ropewikiRoute.route} / page ${ropewikiRoute.page} to queue`);
    }
};
