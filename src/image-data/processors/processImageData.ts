import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import ImageData from '../types/imageData';
import type { SaveImageDataHookFn } from '../hook-functions/saveImageData';
import { downloadSourceImage } from '../http/downloadSourceImage';
import { convertToAvif } from '../util/convertToAvif';
import {
    isPdf,
    getPdfPageCount,
    MULTI_PAGE_PDF_ERROR_MESSAGE,
    renderPdfFirstPageToBuffer,
} from '../util/pdfSource';
import ProgressLogger from '../../helpers/progressLogger';

/**
 * Processes image data: downloads from source URL, converts to AVIF (preview, banner, full),
 * then saves via the provided hook (e.g. upload to S3 in Lambda).
 * On conversion failure, returns an ImageData with errorMessage set (preview/banner/full null).
 *
 * @param sourceImageUrl - URL of the source image
 * @param saveImageDataHookFn - Hook to persist AVIF buffers and return ImageData with URLs
 * @param imageDataId - Optional UUID for ImageData. If not provided, a new UUID is generated.
 * @param logger - Progress logger
 * @returns Promise that resolves to ImageData (with URLs or errorMessage)
 */
export const processImageData = async (
    sourceImageUrl: string,
    saveImageDataHookFn: SaveImageDataHookFn,
    imageDataId: string | null | undefined,
    logger: ProgressLogger,
): Promise<ImageData> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'image-data-'));
    const finalImageDataId = imageDataId ?? randomUUID();

    try {
        const sourceFilePath = await downloadSourceImage(
            sourceImageUrl,
            tempDir,
            finalImageDataId,
        );

        const sourceBuffer = await readFile(sourceFilePath);

        // PDF: reject multi-page, convert single-page to image then to AVIF
        if (isPdf(sourceBuffer)) {
            const pageCount = await getPdfPageCount(sourceBuffer);
            if (pageCount > 1) {
                logger.logError(
                    `Image ${finalImageDataId}: ${MULTI_PAGE_PDF_ERROR_MESSAGE} (${pageCount} pages)`,
                );
                return new ImageData(
                    undefined,
                    undefined,
                    undefined,
                    sourceImageUrl,
                    MULTI_PAGE_PDF_ERROR_MESSAGE,
                    finalImageDataId,
                );
            }
            try {
                const firstPageBuffer = await renderPdfFirstPageToBuffer(sourceFilePath);
                const outputs = await convertToAvif(firstPageBuffer);
                return await saveImageDataHookFn(
                    finalImageDataId,
                    sourceImageUrl,
                    outputs.preview,
                    outputs.banner,
                    outputs.full,
                    logger,
                );
            } catch (pdfConversionError) {
                const errorMessage =
                    pdfConversionError instanceof Error
                        ? pdfConversionError.message
                        : String(pdfConversionError);
                logger.logError(
                    `Single-page PDF conversion failed for ${finalImageDataId}: ${errorMessage}`,
                );
                return new ImageData(
                    undefined,
                    undefined,
                    undefined,
                    sourceImageUrl,
                    errorMessage,
                    finalImageDataId,
                );
            }
        }

        let previewBuffer: Buffer;
        let bannerBuffer: Buffer;
        let fullBuffer: Buffer;

        try {
            const outputs = await convertToAvif(sourceFilePath);
            previewBuffer = outputs.preview;
            bannerBuffer = outputs.banner;
            fullBuffer = outputs.full;
        } catch (conversionError) {
            const errorMessage =
                conversionError instanceof Error
                    ? conversionError.message
                    : String(conversionError);
            logger.logError(`Image conversion failed for ${finalImageDataId}: ${errorMessage}`);
            return new ImageData(
                undefined,
                undefined,
                undefined,
                sourceImageUrl,
                errorMessage,
                finalImageDataId,
            );
        }

        return await saveImageDataHookFn(
            finalImageDataId,
            sourceImageUrl,
            previewBuffer,
            bannerBuffer,
            fullBuffer,
            logger,
        );
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
};
