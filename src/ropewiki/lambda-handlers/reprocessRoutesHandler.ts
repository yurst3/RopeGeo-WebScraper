import type { Pool, PoolClient } from 'pg';
import { PageDataSource } from 'ropegeo-common/models';
import { ProgressLogger } from 'ropegeo-common/helpers';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getAllPages from '../database/getAllPages';
import processRoutes from '../processors/processRoutes';
import type { ProcessRopewikiRoutesHookFn } from '../hook-functions/processRopewikiRoutes';
import sendMapDataSQSMessage from '../sqs/sendMapDataSQSMessage';
import { ReprocessRoutesEvent } from '../types/reprocessRoutesEvent';
import createFreshPageZipperJob from '../../page-zipper/database/createFreshPageZipperJob';

export const reprocessRoutesHandler = async (
    event?: unknown,
): Promise<{ statusCode: number; body: string }> => {
    let reprocessorEvent: ReprocessRoutesEvent;
    try {
        reprocessorEvent = ReprocessRoutesEvent.fromLambdaEvent(event);
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid ReprocessRoutesEvent',
                error: err instanceof Error ? err.message : String(err),
            }),
        };
    }

    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const pages = await getAllPages(client);

        console.log(
            `Reprocessing routes for all ${pages.length} pages` +
                `${reprocessorEvent.remakeDownloadFolders ? ' (remakeDownloadFolders)' : ''}...`,
        );

        const remakeDownloadFolders = reprocessorEvent.remakeDownloadFolders;
        const processHook: ProcessRopewikiRoutesHookFn = async (ropewikiRoutes) => {
            if (ropewikiRoutes.length === 0) {
                return;
            }

            if (remakeDownloadFolders) {
                const pagesWithFreshZipperJob = new Set<string>();
                for (const ropewikiRoute of ropewikiRoutes) {
                    if (
                        ropewikiRoute.page == null ||
                        ropewikiRoute.page === '' ||
                        pagesWithFreshZipperJob.has(ropewikiRoute.page)
                    ) {
                        continue;
                    }
                    pagesWithFreshZipperJob.add(ropewikiRoute.page);
                    await createFreshPageZipperJob(client!, {
                        pageId: ropewikiRoute.page,
                        pageSource: PageDataSource.Ropewiki,
                        pageReady: true,
                        imageDataReady: {},
                        pageHasMapData: true,
                        mapDataLegendItemsReady: null,
                        mapDataId: ropewikiRoute.mapData ?? null,
                    });
                }
            }

            if (process.env.DEV_ENVIRONMENT === 'local') {
                console.log(
                    `Skipping SQS message sending for ${ropewikiRoutes.length} route(s) - no queue configured locally`,
                );
                return;
            }

            const logger = new ProgressLogger(
                'Queueing RopewikiRoutes to map data queue (reprocess)',
                ropewikiRoutes.length,
            );
            logger.setChunk(0, ropewikiRoutes.length);

            for (const ropewikiRoute of ropewikiRoutes) {
                await sendMapDataSQSMessage(
                    ropewikiRoute,
                    false,
                    true,
                    true,
                    remakeDownloadFolders,
                );
                logger.logProgress(
                    `Sent route ${ropewikiRoute.route} / page ${ropewikiRoute.page} to queue`,
                );
            }
        };

        await processRoutes(client, pages, processHook);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Ropewiki route reprocessor completed successfully',
                remakeDownloadFolders: reprocessorEvent.remakeDownloadFolders,
            }),
        };
    } catch (error) {
        console.error('Error in Ropewiki route reprocessor:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki route reprocessor failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
    }
};
