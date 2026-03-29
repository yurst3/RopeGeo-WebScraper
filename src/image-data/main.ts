import { PoolClient } from 'pg';
import { processImageData } from './processors/processImageData';
import upsertImageData from './database/upsertImageData';
import updateProcessedImageForSource from './util/updateProcessedImageForSource';
import type { SaveImageDataHookFn } from './hook-functions/saveImageData';
import { ImageDataEvent } from './types/lambdaEvent';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';

/**
 * Processes image data: obtain source from event, convert to AVIF (preview/banner/full),
 * save via hook, upsert ImageData, and update the source row's processedImage.
 * On conversion failure, processImageData returns ImageData with errorMessage; we still
 * upsert and set processedImage so we don't retry indefinitely.
 *
 * @param imageDataEvent - The event (pageDataSource, pageImageId, sourceUrl, …)
 * @param saveImageDataHookFn - Hook to persist AVIF buffers and return ImageData
 * @param logger - Progress logger
 * @param client - Database client
 * @param abortSignal - Optional AbortSignal; when aborted, the download is cancelled (e.g. on message timeout)
 */
export const main = async (
    imageDataEvent: ImageDataEvent,
    saveImageDataHookFn: SaveImageDataHookFn,
    logger: ProgressLogger,
    client: PoolClient,
    abortSignal?: AbortSignal,
): Promise<void> => {
    const imageData = await processImageData(
        imageDataEvent,
        saveImageDataHookFn,
        logger,
        abortSignal,
    );

    if (abortSignal?.aborted) {
        const reason =
            abortSignal.reason instanceof Error
                ? abortSignal.reason
                : new Error(String(abortSignal.reason));
        throw reason;
    }

    const upserted = await upsertImageData(client, imageData);
    const imageDataId = upserted.id;
    if (!imageDataId) {
        throw new Error('upsertImageData returned ImageData without id');
    }

    await updateProcessedImageForSource(
        client,
        imageDataEvent.pageDataSource,
        imageDataEvent.pageImageId,
        imageDataId,
    );
};
