import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { ImageVersion, VERSION_FORMAT } from 'ropegeo-common';
import ImageData from '../types/imageData';
import type { Metadata } from '../types/metadata';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';
import uploadImageDataToS3, { buildImagePublicUrl } from '../s3/uploadImageDataToS3';
import { ALL_IMAGE_VERSIONS, fileExtensionForImageVersion } from '../util/imageVersionFile';

const SAVED_IMAGE_DATA_DIR = '.savedImageData';

export type SaveImageDataHookFn = (
    imageDataId: string,
    sourceUrl: string | undefined,
    buffers: Partial<Record<ImageVersion, Buffer>>,
    metadata: Metadata,
    logger: ProgressLogger,
) => Promise<ImageData>;

function buildImageData(
    imageDataId: string,
    sourceUrl: string | undefined,
    urls: Partial<Record<ImageVersion, string | undefined>>,
    metadata: Metadata,
    errorMessage?: string,
): ImageData {
    return new ImageData(
        urls[ImageVersion.preview],
        urls[ImageVersion.banner],
        urls[ImageVersion.full],
        urls[ImageVersion.lossless],
        urls[ImageVersion.linkPreview],
        sourceUrl,
        errorMessage,
        imageDataId,
        metadata,
    );
}

/**
 * Lambda save hook: uploads encoded buffers to S3 and returns ImageData with API URLs.
 * When DEV_ENVIRONMENT is "local", skips S3 and returns placeholder URLs.
 */
export const lambdaSaveImageData: SaveImageDataHookFn = async (
    imageDataId: string,
    sourceUrl: string | undefined,
    buffers: Partial<Record<ImageVersion, Buffer>>,
    metadata: Metadata,
    logger: ProgressLogger,
): Promise<ImageData> => {
    const bucket = process.env.IMAGE_BUCKET_NAME;
    if (!bucket) {
        throw new Error('IMAGE_BUCKET_NAME environment variable is not set');
    }

    const devEnvironment = process.env.DEV_ENVIRONMENT;
    const prefix = `${imageDataId}`;
    const urls: Partial<Record<ImageVersion, string | undefined>> = {};

    if (devEnvironment === 'local') {
        logger.logProgress(`Skipping S3 upload for image data ${imageDataId} (local)`);
        for (const v of ALL_IMAGE_VERSIONS) {
            if (buffers[v] != null) {
                urls[v] = buildImagePublicUrl(bucket, `${prefix}/${v}${fileExtensionForImageVersion(v)}`);
            }
        }
        return buildImageData(imageDataId, sourceUrl, urls, metadata);
    }

    const uploadErrors: string[] = [];
    await Promise.all(
        ALL_IMAGE_VERSIONS.map(async (v) => {
            const body = buffers[v];
            if (body == null) {
                return;
            }
            const key = `${prefix}/${v}${fileExtensionForImageVersion(v)}`;
            const contentType = VERSION_FORMAT[v];
            const url = await uploadImageDataToS3(key, body, contentType, uploadErrors);
            if (url != null) {
                urls[v] = url;
            }
        }),
    );

    if (uploadErrors.length > 0) {
        const errorMessage = uploadErrors.join('; ');
        logger.logError(`Image data ${imageDataId}: ${errorMessage}`);
        return buildImageData(imageDataId, sourceUrl, urls, metadata, errorMessage);
    }

    logger.logProgress(`Image data ${imageDataId} uploaded successfully`);
    return buildImageData(imageDataId, sourceUrl, urls, metadata);
};

/**
 * Node save hook: writes buffers under .savedImageData/<imageDataId>/ with file:// URLs.
 */
export const nodeSaveImageData: SaveImageDataHookFn = async (
    imageDataId: string,
    sourceUrl: string | undefined,
    buffers: Partial<Record<ImageVersion, Buffer>>,
    metadata: Metadata,
    logger: ProgressLogger,
): Promise<ImageData> => {
    const projectRoot = process.cwd();
    const dir = join(projectRoot, SAVED_IMAGE_DATA_DIR, imageDataId);
    await mkdir(dir, { recursive: true });

    const writeErrors: string[] = [];
    const urls: Partial<Record<ImageVersion, string | undefined>> = {};

    const writeOne = async (path: string, body: Buffer): Promise<string> => {
        await writeFile(path, body);
        return pathToFileURL(path).href;
    };

    for (const v of ALL_IMAGE_VERSIONS) {
        const body = buffers[v];
        if (body == null) {
            continue;
        }
        const name = `${v}${fileExtensionForImageVersion(v)}`;
        const filePath = join(dir, name);
        try {
            urls[v] = await writeOne(filePath, body);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            writeErrors.push(`${name}: ${msg}`);
        }
    }

    const errorMessage = writeErrors.length ? writeErrors.join('; ') : undefined;
    if (errorMessage) {
        logger.logError(`Image data ${imageDataId}: ${errorMessage}`);
    } else {
        logger.logProgress(`Image data ${imageDataId} saved to ${dir}`);
    }

    return buildImageData(imageDataId, sourceUrl, urls, metadata, errorMessage);
};
