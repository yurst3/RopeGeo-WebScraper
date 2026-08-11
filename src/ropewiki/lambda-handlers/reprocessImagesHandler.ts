import type { Pool, PoolClient } from 'pg';
import { PageDataSource } from 'ropegeo-common/models';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getRopewikiImagesToProcess from '../database/getRopewikiImagesToProcess';
import sendImageProcessorSQSMessage, {
    serializeImageDataEventForQueue,
} from '../../image-data/sqs/sendImageProcessorSQSMessage';
import { ReprocessImagesEvent } from '../types/reprocessImagesEvent';
import createFreshPageZipperJob from '../../page-zipper/database/createFreshPageZipperJob';
import type { ReadinessRecord } from '../../page-zipper/database/upsertPageZipperJob';

/**
 * Lambda handler that enqueues RopewikiImages that need AVIF processing by sending an ImageDataEvent
 * to the image processor queue for each. Options come from {@link ReprocessImagesEvent.fromLambdaEvent}
 * (API Gateway `body` or the same JSON on the root for console / direct invoke).
 */
export const reprocessImagesHandler = async (
    event?: unknown,
): Promise<{ statusCode: number; body: string }> => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    let reprocessImagesEvent: ReprocessImagesEvent;
    try {
        reprocessImagesEvent = ReprocessImagesEvent.fromLambdaEvent(event);
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid ReprocessImagesEvent',
                error: err instanceof Error ? err.message : String(err),
            }),
        };
    }

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const images = await getRopewikiImagesToProcess(
            client,
            reprocessImagesEvent.onlyUnprocessed,
            reprocessImagesEvent.downloadSource,
        );

        console.log(
            `Enqueueing ${images.length} RopewikiImages for image processing` +
                `${reprocessImagesEvent.remakeDownloadFolders ? ' (remakeDownloadFolders)' : ''}...`,
        );

        if (reprocessImagesEvent.remakeDownloadFolders) {
            const imageIdsByPage = new Map<string, string[]>();
            for (const img of images) {
                if (img.pageId == null || img.pageId === '' || img.id == null || img.id === '') {
                    continue;
                }
                const ids = imageIdsByPage.get(img.pageId) ?? [];
                ids.push(img.id);
                imageIdsByPage.set(img.pageId, ids);
            }

            for (const [pageId, imageIds] of imageIdsByPage) {
                const imageDataReady: ReadinessRecord = {};
                for (const imageId of imageIds) {
                    imageDataReady[imageId] = false;
                }
                await createFreshPageZipperJob(client, {
                    pageId,
                    pageSource: PageDataSource.Ropewiki,
                    pageReady: true,
                    pageHasMapData: false,
                    mapDataLegendItemsReady: {},
                    imageDataReady,
                });
            }
        }

        for (const img of images) {
            const imageDataEvent = img.toImageDataEvent(
                reprocessImagesEvent.downloadSource,
                reprocessImagesEvent.versions,
                img.pageId,
                reprocessImagesEvent.remakeDownloadFolders,
            );
            console.log(
                'RopewikiImageReprocessor: enqueue ImageDataEvent',
                serializeImageDataEventForQueue(imageDataEvent),
            );
            await sendImageProcessorSQSMessage(imageDataEvent);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki images completed successfully',
                enqueuedCount: images.length,
                remakeDownloadFolders: reprocessImagesEvent.remakeDownloadFolders,
            }),
        };
    } catch (error) {
        console.error('Error in RopewikiImageReprocessor:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki images failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
    }
};
