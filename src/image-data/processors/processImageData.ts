import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import ImageData from '../types/imageData';
import type { SaveImageDataHookFn } from '../hook-functions/saveImageData';
import type { ImageDataEvent } from '../types/lambdaEvent';
import { convertToAvif } from '../util/convertToAvif';
import {
    isPdf,
    getPdfPageCount,
    MULTI_PAGE_PDF_ERROR_MESSAGE,
    renderPdfFirstPageToBuffer,
} from '../util/pdfSource';
import ProgressLogger from '../../helpers/progressLogger';
import getSource from '../util/getSource';

/**
 * Processes image data: obtains source file (download or S3 lossless), converts to AVIF (preview, banner, full),
 * then saves via the provided hook (e.g. upload to S3 in Lambda).
 * On conversion failure, returns an ImageData with errorMessage set (preview/banner/full null).
 *
 * @param imageDataEvent - Image processing event
 * @param saveImageDataHookFn - Hook to persist AVIF buffers and return ImageData with URLs
 * @param logger - Progress logger
 * @param abortSignal - Optional AbortSignal; when aborted, the download is cancelled
 * @returns Promise that resolves to ImageData (with URLs or errorMessage)
 */
export const processImageData = async (
    imageDataEvent: ImageDataEvent,
    saveImageDataHookFn: SaveImageDataHookFn,
    logger: ProgressLogger,
    abortSignal?: AbortSignal,
): Promise<ImageData> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'image-data-'));
    const imageDataId = imageDataEvent.existingProcessedImageId ?? randomUUID();
    const sourceUrl = imageDataEvent.sourceUrl;

    try {
        const source = await getSource(imageDataEvent, tempDir, imageDataId, abortSignal);
        if (source.errorMessage !== undefined) {
            return ImageData.fromError(source.errorMessage, imageDataId, sourceUrl);
        }

        const sourceFilePath = source.sourceFilePath;
        let conversionSource: string | Buffer = sourceFilePath;

        const sourceBuffer = await readFile(sourceFilePath);

        // PDF: reject multi-page, convert single-page to image then to AVIF
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

        let outputs: Awaited<ReturnType<typeof convertToAvif>>;

        try {
            outputs = await convertToAvif(conversionSource, abortSignal);
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
            outputs.preview,
            outputs.banner,
            outputs.full,
            outputs.lossless,
            outputs.metadata,
            logger,
        );
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
};
