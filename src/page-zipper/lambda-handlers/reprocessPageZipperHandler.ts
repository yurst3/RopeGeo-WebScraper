import type { Pool, PoolClient } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import createFreshPageZipperJob from '../database/createFreshPageZipperJob';
import deleteAllPageZipperJobs from '../database/deleteAllPageZipperJobs';
import { listPageZipReprocessTargets } from '../database/listPageZipReprocessTargets';
import purgePageZipperQueues from '../sqs/purgePageZipperQueues';
import { PageZipReprocessorEvent } from '../types/pageZipReprocessorEvent';

/**
 * Lambda handler that recreates PageZipperJobs for pages needing download folders
 * (or an includePageIds subset), then enqueues each job on PageZipperQueue.
 * Options from {@link PageZipReprocessorEvent.fromLambdaEvent}.
 *
 * Fresh jobs are created fully ready (assets assumed present); PageZipper still runs a
 * defensive {@link isRopewikiPageReadyForFolder} check before zipping.
 */
export const reprocessPageZipper = async (
    event?: unknown,
): Promise<{
    statusCode: number;
    body: string;
}> => {
    let reprocessorEvent: PageZipReprocessorEvent;
    try {
        reprocessorEvent = PageZipReprocessorEvent.fromLambdaEvent(event);
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid PageZipReprocessorEvent',
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
                'PageZipReprocessor: clearing page zipper queues and PageZipperJob rows...',
            );
            await purgePageZipperQueues();
            deletedJobCount = await deleteAllPageZipperJobs(client);
            console.log(`PageZipReprocessor: deleted ${deletedJobCount} PageZipperJob row(s)`);
        }

        const targets = await listPageZipReprocessTargets(
            client,
            reprocessorEvent.includePageIds,
        );

        console.log(
            `PageZipReprocessor: creating and enqueueing ${targets.length} page zipper job(s)${
                reprocessorEvent.clearMessagesAndJobs ? ' (after clear)' : ''
            }${
                reprocessorEvent.includePageIds != null
                    ? ` (includePageIds=${reprocessorEvent.includePageIds.length})`
                    : ''
            }...`,
        );

        for (const target of targets) {
            await createFreshPageZipperJob(client, {
                pageId: target.pageId,
                pageReady: true,
                imageDataReady: {},
                pageHasMapData: false,
                mapDataLegendItemsReady: {},
            });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Page zip reprocessor completed successfully',
                enqueuedCount: targets.length,
                clearMessagesAndJobs: reprocessorEvent.clearMessagesAndJobs,
                ...(reprocessorEvent.clearMessagesAndJobs ? { deletedJobCount } : {}),
                ...(reprocessorEvent.includePageIds != null
                    ? { includePageIds: reprocessorEvent.includePageIds }
                    : {}),
            }),
        };
    } catch (error) {
        console.error('Error in PageZipReprocessor:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Page zip reprocessor failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
    }
};
