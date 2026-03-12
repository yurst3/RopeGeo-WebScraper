import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import ImageData from '../types/imageData';
import type { Metadata } from '../types/metadata';
import ProgressLogger from '../../helpers/progressLogger';
import uploadImageDataToS3, { buildImagePublicUrl } from '../s3/uploadImageDataToS3';

const SAVED_IMAGE_DATA_DIR = '.savedImageData';

export type SaveImageDataHookFn = (
    imageDataId: string,
    sourceUrl: string,
    previewBuffer: Buffer,
    bannerBuffer: Buffer,
    fullBuffer: Buffer,
    losslessBuffer: Buffer,
    metadata: Metadata,
    logger: ProgressLogger,
) => Promise<ImageData>;

/**
 * Lambda save hook: uploads preview, banner, full, and lossless AVIF to S3 and returns ImageData with API URLs.
 * When DEV_ENVIRONMENT is "local", skips S3 and returns ImageData with placeholder URLs.
 */
export const lambdaSaveImageData: SaveImageDataHookFn = async (
    imageDataId: string,
    sourceUrl: string,
    previewBuffer: Buffer,
    bannerBuffer: Buffer,
    fullBuffer: Buffer,
    losslessBuffer: Buffer,
    metadata: Metadata,
    logger: ProgressLogger,
): Promise<ImageData> => {
    const bucket = process.env.IMAGE_BUCKET_NAME;
    if (!bucket) {
        throw new Error('IMAGE_BUCKET_NAME environment variable is not set');
    }

    const devEnvironment = process.env.DEV_ENVIRONMENT;
    if (devEnvironment === 'local') {
        logger.logProgress(`Skipping S3 upload for image data ${imageDataId} (local)`);
        const prefix = `${imageDataId}`;
        return new ImageData(
            buildImagePublicUrl(bucket, `${prefix}/preview.avif`),
            buildImagePublicUrl(bucket, `${prefix}/banner.avif`),
            buildImagePublicUrl(bucket, `${prefix}/full.avif`),
            buildImagePublicUrl(bucket, `${prefix}/lossless.avif`),
            sourceUrl,
            undefined,
            imageDataId,
            metadata,
        );
    }

    const prefix = `${imageDataId}`;
    const uploadErrors: string[] = [];

    const [previewUrl, bannerUrl, fullUrl, losslessUrl] = await Promise.all([
        uploadImageDataToS3(`${prefix}/preview.avif`, previewBuffer, undefined, uploadErrors),
        uploadImageDataToS3(`${prefix}/banner.avif`, bannerBuffer, undefined, uploadErrors),
        uploadImageDataToS3(`${prefix}/full.avif`, fullBuffer, undefined, uploadErrors),
        uploadImageDataToS3(`${prefix}/lossless.avif`, losslessBuffer, undefined, uploadErrors),
    ]);

    if (uploadErrors.length > 0) {
        const errorMessage = uploadErrors.join('; ');
        logger.logError(`Image data ${imageDataId}: ${errorMessage}`);
        return new ImageData(
            undefined,
            undefined,
            undefined,
            undefined,
            sourceUrl,
            errorMessage,
            imageDataId,
            metadata,
        );
    }

    logger.logProgress(`Image data ${imageDataId} uploaded successfully`);
    return new ImageData(
        previewUrl,
        bannerUrl,
        fullUrl,
        losslessUrl,
        sourceUrl,
        undefined,
        imageDataId,
        metadata,
    );
};

/**
 * Node save hook: writes preview, banner, full, and lossless AVIF to .savedImageData/<imageDataId>/ in the
 * project root and returns ImageData with file:// URLs. For local testing of file processing.
 */
export const nodeSaveImageData: SaveImageDataHookFn = async (
    imageDataId: string,
    sourceUrl: string,
    previewBuffer: Buffer,
    bannerBuffer: Buffer,
    fullBuffer: Buffer,
    losslessBuffer: Buffer,
    metadata: Metadata,
    logger: ProgressLogger,
): Promise<ImageData> => {
    const projectRoot = process.cwd();
    const dir = join(projectRoot, SAVED_IMAGE_DATA_DIR, imageDataId);
    await mkdir(dir, { recursive: true });

    const previewPath = join(dir, 'preview.avif');
    const bannerPath = join(dir, 'banner.avif');
    const fullPath = join(dir, 'full.avif');
    const losslessPath = join(dir, 'lossless.avif');

    const writeErrors: string[] = [];

    const writeOne = async (path: string, body: Buffer): Promise<string> => {
        await writeFile(path, body);
        return pathToFileURL(path).href;
    };

    let previewUrl: string | undefined;
    let bannerUrl: string | undefined;
    let fullUrl: string | undefined;
    let losslessUrl: string | undefined;

    try {
        previewUrl = await writeOne(previewPath, previewBuffer);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        writeErrors.push(`preview.avif: ${msg}`);
    }
    try {
        bannerUrl = await writeOne(bannerPath, bannerBuffer);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        writeErrors.push(`banner.avif: ${msg}`);
    }
    try {
        fullUrl = await writeOne(fullPath, fullBuffer);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        writeErrors.push(`full.avif: ${msg}`);
    }
    try {
        losslessUrl = await writeOne(losslessPath, losslessBuffer);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        writeErrors.push(`lossless.avif: ${msg}`);
    }

    const errorMessage = writeErrors.length ? writeErrors.join('; ') : undefined;
    if (errorMessage) {
        logger.logError(`Image data ${imageDataId}: ${errorMessage}`);
    } else {
        logger.logProgress(`Image data ${imageDataId} saved to ${dir}`);
    }

    return new ImageData(
        previewUrl,
        bannerUrl,
        fullUrl,
        losslessUrl,
        sourceUrl,
        errorMessage,
        imageDataId,
        metadata,
    );
};
