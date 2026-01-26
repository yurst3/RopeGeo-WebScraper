import { PoolClient } from 'pg';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { main } from '../main';
import { lambdaSaveMapData } from '../hook-functions/saveMapData';
import { MapDataEvent } from '../types/lambdaEvent';
import ProgressLogger from '../../helpers/progressLogger';
import deleteMapDataSQSMessage from './deleteMapDataSQSMessage';
import setMapDataSQSMessageRetryTime from './setMapDataSQSMessageRetryTime';

/**
 * Handles processing of map data from SQS records.
 * Processes each record and handles errors gracefully per message.
 * 
 * @param records - Array of SQS records containing MapDataEvent data in each record's body
 * @param client - Database client
 * @returns Object containing the number of successes, errors, and remaining messages
 */
const handleMapDataSQSMessages = async (
    records: SqsRecord[],
    client: PoolClient,
): Promise<{ successes: number; errors: number; remaining: number }> => {
    const totalRecords = records.length;

    // Initialize progress logger
    const logger = new ProgressLogger('Processing map data', totalRecords);
    logger.setChunk(0, totalRecords);

    for (const record of records) {
        let mapDataEvent: MapDataEvent | undefined;

        try {
            // Parse the MapDataEvent from the SQS record
            mapDataEvent = MapDataEvent.fromSQSEventRecord(record);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error parsing MapDataEvent from SQSEventRecord: ${errorMessage}`);
            
            // Delete the message from the queue so we don't keep reprocessing the bad message
            await deleteMapDataSQSMessage(record.receiptHandle);
            continue;
        }

        try {
            // Process the map data event
            await main(mapDataEvent, lambdaSaveMapData, logger, client);

            // Delete the message from the queue so we don't keep reprocessing it
            await deleteMapDataSQSMessage(record.receiptHandle);
        } catch (error) {
            // Log the error and set retry time for this specific message
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error processing map data for route ${mapDataEvent.routeId} / page ${mapDataEvent.pageId}: ${errorMessage}`);
            
            // Set retry time for this failed message and continue to the next
            await setMapDataSQSMessageRetryTime(record.receiptHandle, 43200);
        }
    }

    return logger.getResults();
};

export default handleMapDataSQSMessages;
