import type { Pool, PoolClient } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import { listRopewikiMapDataReprocessTargets } from '../database/listRopewikiMapDataReprocessTargets';
import { MapDataReprocessorEvent } from '../types/mapDataReprocessorEvent';
import sendMapDataSQSMessage from '../../ropewiki/sqs/sendMapDataSQSMessage';
import { RopewikiRoute } from '../../types/pageRoute';

/**
 * Lambda handler that enqueues map-data processing jobs for Ropewiki routes linked to MapData.
 * Options from {@link MapDataReprocessorEvent.fromLambdaEvent} (API `body` or direct invoke JSON).
 */
export const reprocessMapData = async (
    event?: unknown,
): Promise<{ statusCode: number; body: string }> => {
    let reprocessorEvent: MapDataReprocessorEvent;
    try {
        reprocessorEvent = MapDataReprocessorEvent.fromLambdaEvent(event);
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid MapDataReprocessorEvent',
                error: err instanceof Error ? err.message : String(err),
            }),
        };
    }

    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const onlyStored = !reprocessorEvent.downloadSource;
        const targets = await listRopewikiMapDataReprocessTargets(client, onlyStored);

        console.log(
            `MapDataReprocessor: enqueueing ${targets.length} map-data job(s) (downloadSource=${reprocessorEvent.downloadSource})...`,
        );

        for (const row of targets) {
            const ropewikiRoute = new RopewikiRoute(row.routeId, row.pageId, row.mapDataId);
            await sendMapDataSQSMessage(ropewikiRoute, reprocessorEvent.downloadSource);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'MapData reprocessor completed successfully',
                enqueuedCount: targets.length,
                downloadSource: reprocessorEvent.downloadSource,
            }),
        };
    } catch (error) {
        console.error('Error in MapDataReprocessor:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'MapData reprocessor failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
        if (pool) await pool.end();
    }
};
