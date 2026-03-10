import { readFile } from 'fs/promises';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import ImageData from '../types/imageData';
import ProgressLogger from '../../helpers/progressLogger';
import putS3Object from '../../helpers/s3/putS3Object';

const SAVED_IMAGE_DATA_DIR = '.savedImageData';

const IMAGE_AVIF_CONTENT_TYPE = 'image/avif';

/**
 * Builds the public API URL for an image object.
 * When IMAGE_PUBLIC_BASE_URL is set (e.g. CloudFront), returns base + "/images/" + key
 * so requests go through CloudFront /images/* behavior. Otherwise returns S3 URL.
 */
const buildImagePublicUrl = (bucket: string, key: string): string => {
    const base = process.env.IMAGE_PUBLIC_BASE_URL;
    if (base) {
        const normalized = base.replace(/\/$/, '');
        return `${normalized}/images/${key}`;
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`;
};

export type SaveImageDataHookFn = (
    imageDataId: string,
    sourceUrl: string,
    previewBuffer: Buffer,
    bannerBuffer: Buffer,
    fullBuffer: Buffer,
    logger: ProgressLogger,
) => Promise<ImageData>;

/**
 * Lambda save hook: uploads preview, banner, and full AVIF to S3 and returns ImageData with API URLs.
 * When DEV_ENVIRONMENT is "local", skips S3 and returns ImageData with placeholder URLs.
 */
export const lambdaSaveImageData: SaveImageDataHookFn = async (
    imageDataId: string,
    sourceUrl: string,
    previewBuffer: Buffer,
    bannerBuffer: Buffer,
    fullBuffer: Buffer,
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
            sourceUrl,
            undefined,
            imageDataId,
        );
    }

    const prefix = `${imageDataId}`;
    const uploadErrors: string[] = [];

    const uploadOne = async (
        key: string,
        body: Buffer,
    ): Promise<string> => {
        try {
            await putS3Object(bucket, key, body, IMAGE_AVIF_CONTENT_TYPE);
            return buildImagePublicUrl(bucket, key);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            uploadErrors.push(`${key}: ${msg}`);
            throw error;
        }
    };

    let previewUrl: string | undefined;
    let bannerUrl: string | undefined;
    let fullUrl: string | undefined;

    try {
        [previewUrl, bannerUrl, fullUrl] = await Promise.all([
            uploadOne(`${prefix}/preview.avif`, previewBuffer),
            uploadOne(`${prefix}/banner.avif`, bannerBuffer),
            uploadOne(`${prefix}/full.avif`, fullBuffer),
        ]);
    } catch {
        const errorMessage = uploadErrors.length ? uploadErrors.join('; ') : 'Upload failed';
        logger.logError(`Image data ${imageDataId}: ${errorMessage}`);
        return new ImageData(
            undefined,
            undefined,
            undefined,
            sourceUrl,
            errorMessage,
            imageDataId,
        );
    }

    logger.logProgress(`Image data ${imageDataId} uploaded successfully`);
    return new ImageData(previewUrl, bannerUrl, fullUrl, sourceUrl, undefined, imageDataId);
};

/**
 * Node save hook: writes preview, banner, and full AVIF to .savedImageData/<imageDataId>/ in the
 * project root and returns ImageData with file:// URLs. For local testing of file processing.
 */
export const nodeSaveImageData: SaveImageDataHookFn = async (
    imageDataId: string,
    sourceUrl: string,
    previewBuffer: Buffer,
    bannerBuffer: Buffer,
    fullBuffer: Buffer,
    logger: ProgressLogger,
): Promise<ImageData> => {
    const projectRoot = process.cwd();
    const dir = join(projectRoot, SAVED_IMAGE_DATA_DIR, imageDataId);
    await mkdir(dir, { recursive: true });

    const previewPath = join(dir, 'preview.avif');
    const bannerPath = join(dir, 'banner.avif');
    const fullPath = join(dir, 'full.avif');

    const writeErrors: string[] = [];

    const writeOne = async (path: string, body: Buffer): Promise<string> => {
        await writeFile(path, body);
        return pathToFileURL(path).href;
    };

    let previewUrl: string | undefined;
    let bannerUrl: string | undefined;
    let fullUrl: string | undefined;

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

    const errorMessage = writeErrors.length ? writeErrors.join('; ') : undefined;
    if (errorMessage) {
        logger.logError(`Image data ${imageDataId}: ${errorMessage}`);
    } else {
        logger.logProgress(`Image data ${imageDataId} saved to ${dir}`);
    }

    return new ImageData(previewUrl, bannerUrl, fullUrl, sourceUrl, errorMessage, imageDataId);
};
