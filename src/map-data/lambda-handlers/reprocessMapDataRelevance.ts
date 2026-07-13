import type { Pool, PoolClient } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import { listRelevanceReprocessTargets } from '../database/listRelevanceReprocessTargets';
import createFreshRelevanceContextJob from '../database/createFreshRelevanceContextJob';

/**
 * Lambda handler that recreates MapDataRelevantContextJobs for every Ropewiki page whose
 * preferred MapData has legend items, then enqueues each job on MapDataRelevanceProcessingQueue.
 */
export const reprocessMapDataRelevance = async (): Promise<{
    statusCode: number;
    body: string;
}> => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const targets = await listRelevanceReprocessTargets(client);

        console.log(
            `MapDataRelevanceReprocessor: creating and enqueueing ${targets.length} relevance job(s)...`,
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
