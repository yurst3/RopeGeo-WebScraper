import type { PoolClient } from 'pg';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import getImageDataMetadataById from '../database/getImageDataMetadataById';
import ImageData from '../types/imageData';
import type { SaveImageDataHookFn } from '../hook-functions/saveImageData';
import type { ImageDataEvent } from '../types/lambdaEvent';
import { convertSource } from '../util/convertSource';
import { ALL_IMAGE_VERSIONS } from '../util/imageVersionFile';
import {
    isPdf,
    getPdfPageCount,
    MULTI_PAGE_PDF_ERROR_MESSAGE,
    renderPdfFirstPageToBuffer,
} from '../util/pdfSource';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';
import getSource from '../util/getSource';

/**
 * Processes image data: obtains source, encodes requested versions, then saves via the hook.
 * Loads existing ImageData metadata via {@link client} before conversion and passes it to {@link convertSource}.
 */
export const processImageData = async (
    imageDataEvent: ImageDataEvent,
    saveImageDataHookFn: SaveImageDataHookFn,
    logger: ProgressLogger,
    imageDataId: string,
    client: PoolClient,
    abortSignal?: AbortSignal,
): Promise<ImageData> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'image-data-'));
    const sourceUrl = imageDataEvent.sourceUrl;
    const versions = imageDataEvent.versions ?? ALL_IMAGE_VERSIONS;

    try {
        const source = await getSource(imageDataEvent, tempDir, imageDataId, abortSignal);
        if (source.errorMessage !== undefined) {
            return ImageData.fromError(source.errorMessage, imageDataId, sourceUrl);
        }

        const sourceFilePath = source.sourceFilePath;
        let conversionSource: string | Buffer = sourceFilePath;

        const sourceBuffer = await readFile(sourceFilePath);

        if (isPdf(sourceBuffer)) {
            const pageCount = await getPdfPageCount(sourceBuffer);
            if (pageCount > 1) {
                logger.logError(
                    `Image ${imageDataId}: ${MULTI_PAGE_PDF_ERROR_MESSAGE} (${pageCount} pages)`,
                );
                return ImageData.fromError(
                    MULTI_PAGE_PDF_ERROR_MESSAGE,
                    imageDataId,
                    sourceUrl,
                );
            }
            try {
                conversionSource = await renderPdfFirstPageToBuffer(sourceFilePath);
            } catch (pdfConversionError) {
                const errorMessage =
                    pdfConversionError instanceof Error
                        ? pdfConversionError.message
                        : String(pdfConversionError);
                logger.logError(
                    `Single-page PDF conversion failed for ${imageDataId}: ${errorMessage}`,
                );
                return ImageData.fromError(errorMessage, imageDataId, sourceUrl);
            }
        }

        const existingMetadata = (await getImageDataMetadataById(client, imageDataId)) ?? undefined;

        let result: Awaited<ReturnType<typeof convertSource>>;

        try {
            result = await convertSource(conversionSource, versions, abortSignal, existingMetadata);
        } catch (conversionError) {
            const errorMessage =
                conversionError instanceof Error
                    ? conversionError.message
                    : String(conversionError);
            logger.logError(`Image conversion failed for ${imageDataId}: ${errorMessage}`);
            return ImageData.fromError(errorMessage, imageDataId, sourceUrl);
        }

        return await saveImageDataHookFn(
            imageDataId,
            sourceUrl,
            result.buffers,
            result.metadata,
            logger,
        );
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
};
