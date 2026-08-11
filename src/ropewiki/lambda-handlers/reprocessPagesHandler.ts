import type { Pool, PoolClient } from 'pg';
import { PageDataSource } from 'ropegeo-common/models';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getAllPages from '../database/getAllPages';
import sendProcessPageSQSMessage from '../sqs/sendProcessPageSQSMessage';
import { ReprocessPagesEvent } from '../types/reprocessPagesEvent';
import createFreshPageZipperJob from '../../page-zipper/database/createFreshPageZipperJob';

/**
 * Lambda handler that enqueues RopewikiPages to the page processor queue
 * so each page is re-fetched, parsed, and upserted (beta sections, images, site links).
 * Options from {@link ReprocessPagesEvent.fromLambdaEvent}.
 */
export const reprocessPagesHandler = async (
    event?: unknown,
): Promise<{ statusCode: number; body: string }> => {
    let reprocessorEvent: ReprocessPagesEvent;
    try {
        reprocessorEvent = ReprocessPagesEvent.fromLambdaEvent(event);
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid ReprocessPagesEvent',
                error: err instanceof Error ? err.message : String(err),
            }),
        };
    }

    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        let pages = await getAllPages(client);
        if (reprocessorEvent.includePageIds != null) {
            const include = new Set(reprocessorEvent.includePageIds);
            pages = pages.filter((page) => page.id != null && include.has(page.id));
        }

        console.log(
            `Enqueueing ${pages.length} RopewikiPages for page processing` +
                `${reprocessorEvent.remakeDownloadFolders ? ' (remakeDownloadFolders)' : ''}` +
                `${reprocessorEvent.includePageIds != null ? ` (includePageIds=${reprocessorEvent.includePageIds.length})` : ''}...`,
        );

        for (const page of pages) {
            if (reprocessorEvent.remakeDownloadFolders && page.id != null) {
                await createFreshPageZipperJob(client, {
                    pageId: page.id,
                    pageSource: PageDataSource.Ropewiki,
                    pageReady: false,
                    imageDataReady: null,
                    pageHasMapData: true,
                });
            }

            await sendProcessPageSQSMessage(page, reprocessorEvent.remakeDownloadFolders);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki pages completed successfully',
                enqueuedCount: pages.length,
                remakeDownloadFolders: reprocessorEvent.remakeDownloadFolders,
                ...(reprocessorEvent.includePageIds != null
                    ? { includePageIds: reprocessorEvent.includePageIds }
                    : {}),
            }),
        };
    } catch (error) {
        console.error('Error in RopewikiPageReprocessor:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki pages failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
    }
};
