import type { Pool, PoolClient } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getRopewikiImagesToProcess from '../database/getRopewikiImagesToProcess';
import sendImageProcessorSQSMessage, {
    serializeImageDataEventForQueue,
} from '../../image-data/sqs/sendImageProcessorSQSMessage';
import { ReprocessImagesEvent } from '../types/reprocessImagesEvent';

/**
 * Lambda handler that enqueues RopewikiImages that need AVIF processing by sending an ImageDataEvent
 * to the image processor queue for each. Options come from the Lambda event body (JSON) when present.
 */
export const reprocessImagesHandler = async (
    event?: unknown,
): Promise<{ statusCode: number; body: string }> => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    let reprocessImagesEvent: ReprocessImagesEvent;
    try {
        console.log('Event', event);
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

        console.log(`Enqueueing ${images.length} RopewikiImages for image processing...`);

        for (const img of images) {
            const imageDataEvent = img.toImageDataEvent(
                reprocessImagesEvent.downloadSource,
                reprocessImagesEvent.versions,
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
        if (pool) await pool.end();
    }
};
