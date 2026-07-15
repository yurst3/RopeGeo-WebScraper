import type { Pool, PoolClient } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import { listRelevanceReprocessTargets } from '../database/listRelevanceReprocessTargets';
import createFreshRelevanceContextJob from '../database/createFreshRelevanceContextJob';
import deleteAllRelevantContextJobs from '../database/deleteAllRelevantContextJobs';
import purgeRelevanceQueues from '../sqs/purgeRelevanceQueues';
import { MapDataRelevanceReprocessorEvent } from '../types/mapDataRelevanceReprocessorEvent';

/**
 * Lambda handler that recreates MapDataRelevantContextJobs for Ropewiki pages whose
 * preferred MapData has legend items, then enqueues each job on MapDataRelevanceProcessingQueue.
 * Options from {@link MapDataRelevanceReprocessorEvent.fromLambdaEvent}.
 */
export const reprocessMapDataRelevance = async (
    event?: unknown,
): Promise<{
    statusCode: number;
    body: string;
}> => {
    let reprocessorEvent: MapDataRelevanceReprocessorEvent;
    try {
        reprocessorEvent = MapDataRelevanceReprocessorEvent.fromLambdaEvent(event);
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid MapDataRelevanceReprocessorEvent',
                error: err instanceof Error ? err.message : String(err),
            }),
        };
    }

    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        let deletedJobCount = 0;
        if (reprocessorEvent.clearMessagesAndJobs) {
            console.log(
                'MapDataRelevanceReprocessor: clearing relevance queues and MapDataRelevantContextJob rows...',
            );
            await purgeRelevanceQueues();
            deletedJobCount = await deleteAllRelevantContextJobs(client);
            console.log(
                `MapDataRelevanceReprocessor: deleted ${deletedJobCount} MapDataRelevantContextJob row(s)`,
            );
        }

        const targets = await listRelevanceReprocessTargets(
            client,
            reprocessorEvent.includeMapDataIds,
        );

        console.log(
            `MapDataRelevanceReprocessor: creating and enqueueing ${targets.length} relevance job(s)${
                reprocessorEvent.clearMessagesAndJobs ? ' (after clear)' : ''
            }${
                reprocessorEvent.includeMapDataIds != null
                    ? ` (includeMapDataIds=${reprocessorEvent.includeMapDataIds.length})`
                    : ''
            }...`,
        );

        for (const target of targets) {
            await createFreshRelevanceContextJob(client, {
                mapDataId: target.mapDataId,
                pageId: target.pageId,
            });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'MapData relevance reprocessor completed successfully',
                enqueuedCount: targets.length,
                clearMessagesAndJobs: reprocessorEvent.clearMessagesAndJobs,
                ...(reprocessorEvent.clearMessagesAndJobs ? { deletedJobCount } : {}),
                ...(reprocessorEvent.includeMapDataIds != null
                    ? { includeMapDataIds: reprocessorEvent.includeMapDataIds }
                    : {}),
            }),
        };
    } catch (error) {
        console.error('Error in MapDataRelevanceReprocessor:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'MapData relevance reprocessor failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
    }
};
