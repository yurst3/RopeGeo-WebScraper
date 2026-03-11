import { processImageData } from '../src/image-data/processors/processImageData';
import { nodeSaveImageData } from '../src/image-data/hook-functions/saveImageData';
import ProgressLogger from '../src/helpers/progressLogger';

function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.round(ms % 1000);
    return `${minutes} minute(s), ${seconds} second(s), ${milliseconds} millisecond(s)`;
}

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

    try {
        await processImageData(url, nodeSaveImageData, undefined, logger);
    } catch (error) {
        console.error('Error processing image:', error);
        process.exit(1);
    }

    const elapsedMs = performance.now() - start;

    console.log(`\nProcessed in ${formatElapsed(elapsedMs)}`);
}

if (require.main === module) {
    testImageProcessTime();
}
