import { PoolClient } from 'pg';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { main } from '../main';
import { lambdaSaveMapData } from '../hook-functions/saveMapData';
import { MapDataEvent } from '../types/lambdaEvent';
import ProgressLogger from '../../helpers/progressLogger';
import deleteMapDataSQSMessage from './deleteMapDataSQSMessage';
import { timeoutAfter } from '../../helpers/timeoutAfter';

/**
 * Handles processing of map data from SQS records.
 * Processes each record and handles errors gracefully per message.
 * Stops starting new work when Lambda remaining time is below processMessageTimeoutMs so the
 * invocation can finish and unprocessed messages become visible again for retry.
 *
 * @param records - Array of SQS records containing MapDataEvent data in each record's body
 * @param client - Database client
 * @param lambdaTimeoutMs - Lambda timeout in ms (used to divide time across records)
 * @param getRemainingTimeInMillis - Callback returning remaining Lambda time in ms (e.g. from context.getRemainingTimeInMillis)
 * @returns Object containing the number of successes, errors, and remaining messages
 */
const handleMapDataSQSMessages = async (
    records: SqsRecord[],
    client: PoolClient,
    lambdaTimeoutMs: number,
    getRemainingTimeInMillis: () => number,
): Promise<{ successes: number; errors: number; remaining: number }> => {
    const totalRecords = records.length;

    const logger = new ProgressLogger('Processing map data', totalRecords);
    logger.setChunk(0, totalRecords);

    const processMessageTimeoutMs = Math.floor(lambdaTimeoutMs / totalRecords);

    for (let i = 0; i < records.length; i++) {
        const remainingMs = getRemainingTimeInMillis();
        if (totalRecords > 1 && remainingMs < processMessageTimeoutMs) {
            console.warn(
                `Stopping before message ${i + 1}/${totalRecords}: only ${remainingMs}ms remaining (need ${processMessageTimeoutMs}ms to start a message). Unprocessed messages will retry.`,
            );
            break;
        }

        const record = records[i]!;
        let mapDataEvent: MapDataEvent | undefined;

        try {
            mapDataEvent = MapDataEvent.fromSQSEventRecord(record);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error parsing MapDataEvent from SQSEventRecord: ${errorMessage}`);
            await deleteMapDataSQSMessage(record.receiptHandle);
            continue;
        }

        try {
            await timeoutAfter(processMessageTimeoutMs, () =>
                main(mapDataEvent!, lambdaSaveMapData, logger, client),
            );
            await deleteMapDataSQSMessage(record.receiptHandle);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.logError(`Error processing map data for route ${mapDataEvent.routeId} / page ${mapDataEvent.pageId}: ${errorMessage}`);
        }
    }

    return logger.getResults();
};

export default handleMapDataSQSMessages;
