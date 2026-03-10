import type { Pool, PoolClient } from 'pg';
import { PageDataSource } from 'ropegeo-common';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getRopewikiImagesToProcess from '../database/getRopewikiImagesToProcess';
import sendImageProcessorSQSMessage from '../../image-data/sqs/sendImageProcessorSQSMessage';
import { ImageDataEvent } from '../../image-data/types/lambdaEvent';

/**
 * Lambda handler that enqueues all RopewikiImages that need AVIF processing
 * (no processedImage, or ImageData.sourceUrl !== image fileUrl) by sending
 * an ImageDataEvent to the image processor queue for each.
 */
export const reprocessImagesHandler = async (): Promise<{ statusCode: number; body: string }> => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const images = await getRopewikiImagesToProcess(client);

        console.log(`Enqueueing ${images.length} RopewikiImages for image processing...`);

        for (const row of images) {
            const event = new ImageDataEvent(PageDataSource.Ropewiki, row.id, row.fileUrl);
            await sendImageProcessorSQSMessage(event);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki images completed successfully',
                enqueuedCount: images.length,
            }),
        };
    } catch (error) {
        console.error('Error in ReprocessRopewikiImages:', error);
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
