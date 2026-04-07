import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { PageDataSource } from 'ropegeo-common/models';
import { processImageData } from '../src/image-data/processors/processImageData';
import { nodeSaveImageData } from '../src/image-data/hook-functions/saveImageData';
import { ImageDataEvent } from '../src/image-data/types/lambdaEvent';
import { ProgressLogger } from 'ropegeo-common/helpers';

function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.round(ms % 1000);
    return `${minutes} minute(s), ${seconds} second(s), ${milliseconds} millisecond(s)`;
}

/** Minimal client so metadata lookup returns no row (no DB required for local timing). */
const localTimingDbClient = {
    query: async () => ({ rows: [] }),
} as unknown as PoolClient;

/**
 * Script to time how long it takes to process an image from a URL.
 * Usage: ts-node scripts/testImageProcessTime.ts <imageUrl>
 * Output is written to .savedImageData/<id>/ in the project root.
 */
async function testImageProcessTime() {
    const url = process.argv[2];

    if (!url) {
        console.error('Usage: ts-node scripts/testImageProcessTime.ts <imageUrl>');
        process.exit(1);
    }

    const logger = new ProgressLogger('Processing image', 1);
    logger.setChunk(0, 1);

    const start = performance.now();

    let imageData;
    try {
        const imageDataId = randomUUID();
        const event = new ImageDataEvent(PageDataSource.Ropewiki, randomUUID(), url, true);
        imageData = await processImageData(event, nodeSaveImageData, logger, imageDataId, localTimingDbClient);
    } catch (error) {
        console.error('Error processing image:', error);
        process.exit(1);
    }

    const elapsedMs = performance.now() - start;

    console.log(`\nProcessed in ${formatElapsed(elapsedMs)}`);

    if (imageData.metadata) {
        console.log('\nMetadata:');
        console.log(JSON.stringify(imageData.metadata.toJSON(), null, 2));
    }
}

if (require.main === module) {
    testImageProcessTime();
}
