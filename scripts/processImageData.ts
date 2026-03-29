import getDatabaseConnection from '../src/helpers/getDatabaseConnection';
import { PageDataSource } from 'ropegeo-common';
import { main } from '../src/image-data/main';
import { nodeSaveImageData } from '../src/image-data/hook-functions/saveImageData';
import { ImageDataEvent } from '../src/image-data/types/lambdaEvent';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';

const queries: Record<PageDataSource, string> = {
    [PageDataSource.Ropewiki]: `
        SELECT id, "fileUrl"
        FROM "RopewikiImage"
        WHERE "deletedAt" IS NULL
        ORDER BY RANDOM()
        LIMIT 1
    `,
};

/** When filtering by extension, use a parameterized query. $1 = ILIKE pattern (e.g. '%.jpg'). */
const queriesByExtension: Record<PageDataSource, string> = {
    [PageDataSource.Ropewiki]: `
        SELECT id, "fileUrl"
        FROM "RopewikiImage"
        WHERE "deletedAt" IS NULL
          AND "fileUrl" ILIKE $1
        ORDER BY RANDOM()
        LIMIT 1
    `,
};

type ImageRow = { id: string; fileUrl: string };

/** Normalize and validate file extension: lowercase, no leading dot, alphanumeric only. */
function parseFileExtension(arg: string | undefined): string | null {
    if (arg == null || arg === '') return null;
    const ext = arg.replace(/^\./, '').toLowerCase();
    if (!/^[a-z0-9]+$/.test(ext)) return null;
    return ext;
}

/**
 * Script to process image data for a random image from the database.
 * Writes converted AVIF files to .savedImageData/<id>/ in the project root.
 * Usage: ts-node processImageData.ts <pageDataSource> [fileExtension]
 * Currently only 'ropewiki' is supported. Optional fileExtension filters by URL suffix (e.g. jpg, png).
 */
async function processImageDataScript() {
    const pageDataSourceArg = process.argv[2];
    const fileExtensionArg = parseFileExtension(process.argv[3]);

    if (!pageDataSourceArg) {
        console.error('Usage: ts-node processImageData.ts <pageDataSource> [fileExtension]');
        console.error('Currently only "ropewiki" is supported.');
        process.exit(1);
    }

    if (process.argv[3] !== undefined && fileExtensionArg === null) {
        console.error('Invalid fileExtension: must be alphanumeric (e.g. jpg, png).');
        process.exit(1);
    }

    if (!Object.values(PageDataSource).includes(pageDataSourceArg as PageDataSource)) {
        console.error(
            `Invalid pageDataSource: ${pageDataSourceArg}. pageDataSource must be one of ${Object.values(PageDataSource).join(', ')}`,
        );
        process.exit(1);
    }

    const pool = await getDatabaseConnection();
    const client = await pool.connect();

    try {
        const pageDataSource = pageDataSourceArg as PageDataSource;
        const result = fileExtensionArg
            ? await pool.query<ImageRow>(queriesByExtension[pageDataSource], [`%.${fileExtensionArg}`])
            : await pool.query<ImageRow>(queries[pageDataSource]);

        if (result.rows.length === 0) {
            if (fileExtensionArg) {
                console.error(`No images found with file extension .${fileExtensionArg} for source ${pageDataSource}.`);
            } else {
                console.error(`No image row found in the database for source ${pageDataSource}`);
            }
            process.exit(1);
        }

        const row = result.rows[0]!;
        const event = new ImageDataEvent(pageDataSource, row.id, row.fileUrl);

        console.log(`Selected image (${pageDataSource}) id=${row.id}, fileUrl=${row.fileUrl}`);

        const logger = new ProgressLogger('Processing image data', 1);
        logger.setChunk(0, 1);

        await main(event, nodeSaveImageData, logger, client);

        console.log('Image data processing complete. Output in .savedImageData/');
    } catch (error) {
        console.error('Error processing image data:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    processImageDataScript();
}
