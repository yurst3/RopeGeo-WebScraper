/**
 * One-off Fargate task: migrate ImageData rows to the new schema.
 * For each row where fullUrl IS NULL and losslessUrl IS NOT NULL, downloads the
 * existing S3 object {id}/full.avif to a temp file, runs the AVIF pipeline to
 * generate preview, banner, full (q75), and lossless, gets source size via HEAD
 * to sourceUrl (with retries; on failure sets metadata.source = null), uploads
 * the four AVIFs to S3, and upserts the row with fullUrl and metadata.
 * Processes rows in chunks of 10 in parallel within each chunk.
 *
 * Requires: IMAGE_BUCKET_NAME, IMAGE_PUBLIC_BASE_URL, DB_*, DEV_ENVIRONMENT.
 */

import { join } from 'path';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';
import chunk from 'lodash/chunk';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import ProgressLogger from '../../helpers/progressLogger';
import { getImageDataToMigrate } from './database/getImageDataToMigrate';
import type { ImageDataRowToMigrate } from './database/getImageDataToMigrate';
import { getS3ObjectToFile } from './util/getS3ObjectToFile';
import { headSourceSizeKb } from './util/headSourceSizeKb';
import { runAvifPipeline } from '../../image-data/util/runAvifPipeline';
import uploadImageDataToS3 from '../../image-data/s3/uploadImageDataToS3';
import upsertImageData from '../../image-data/database/upsertImageData';
import ImageData from '../../image-data/types/imageData';
import type { PoolClient } from 'pg';

const CHUNK_SIZE = 10;

function assertRequiredEnv(): void {
    if (!process.env.IMAGE_BUCKET_NAME) {
        throw new Error('Missing required environment variable: IMAGE_BUCKET_NAME');
    }
    if (!process.env.IMAGE_PUBLIC_BASE_URL) {
        throw new Error('Missing required environment variable: IMAGE_PUBLIC_BASE_URL');
    }
}

async function processRow(
    row: ImageDataRowToMigrate,
    bucket: string,
    client: PoolClient,
    logger: ProgressLogger,
): Promise<void> {
    const { id, sourceUrl } = row;
    const tempPath = join(tmpdir(), `migrate-${id}.avif`);
    try {
        await getS3ObjectToFile(bucket, `${id}/full.avif`, tempPath);
    } catch (s3Err) {
        const msg = s3Err instanceof Error ? s3Err.message : String(s3Err);
        logger.logError(`id ${id}: S3 GetObject failed: ${msg}`);
        return;
    }

    try {
        const headResult = await headSourceSizeKb(sourceUrl ?? '', true);

        const outputs = await runAvifPipeline(tempPath);
        if (headResult !== null) {
            if (outputs.metadata.source) {
                outputs.metadata.source.sizeKB = headResult.sizeKB;
            }
        } else {
            outputs.metadata.source = null;
        }

        const prefix = `${id}`;
        const [previewUrl, bannerUrl, fullUrl, losslessUrl] = await Promise.all([
            uploadImageDataToS3(`${prefix}/preview.avif`, outputs.preview),
            uploadImageDataToS3(`${prefix}/banner.avif`, outputs.banner),
            uploadImageDataToS3(`${prefix}/full.avif`, outputs.full),
            uploadImageDataToS3(`${prefix}/lossless.avif`, outputs.lossless),
        ]);

        const imageData = new ImageData(
            previewUrl,
            bannerUrl,
            fullUrl,
            losslessUrl,
            sourceUrl ?? undefined,
            undefined,
            id,
            outputs.metadata,
        );
        await upsertImageData(client, imageData);
        logger.logProgress(`Migrated id ${id}`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.logError(`id ${id}: ${msg}`);
    } finally {
        await unlink(tempPath).catch(() => {});
    }
}

export async function main(): Promise<void> {
    assertRequiredEnv();
    const bucket = process.env.IMAGE_BUCKET_NAME!;
    let pool: Awaited<ReturnType<typeof getDatabaseConnection>> | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();
        const rows = await getImageDataToMigrate(client);
        if (rows.length === 0) {
            console.log('No ImageData rows to migrate.');
            return;
        }

        const logger = new ProgressLogger('Migrating ImageData', rows.length);

        let offset = 0;
        for (const chunkRows of chunk(rows, CHUNK_SIZE)) {
            const chunkStart = offset;
            const chunkEnd = offset + chunkRows.length - 1;
            logger.setChunk(chunkStart, chunkEnd);

            await Promise.all(
                chunkRows.map((row) => processRow(row, bucket, client!, logger)),
            );
            offset += chunkRows.length;
        }

        const { successes, errors } = logger.getResults();
        console.log(`Migration complete: ${successes} success(es), ${errors} error(s).`);
    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        client?.release();
        await pool?.end();
    }
}

if (require.main === module) {
    main().then(
        () => process.exit(0),
        (err) => {
            console.error(err);
            process.exit(1);
        },
    );
}
