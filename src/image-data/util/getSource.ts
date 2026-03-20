import { writeFile } from 'fs/promises';
import { PageDataSource } from 'ropegeo-common';
import type { ImageDataEvent } from '../types/lambdaEvent';
import { downloadSourceImage } from '../http/downloadSourceImage';
import getLosslessFile from '../s3/getLosslessFile';

export const NO_LOSSLESS_WHEN_SKIPPING_DOWNLOAD_MESSAGE =
    'No lossless image available when downloadSource is False';

export type GetSourceResult = {
    sourceFilePath: string;
    errorMessage: string | undefined;
};

const getSource = async (
    imageDataEvent: ImageDataEvent,
    tempDir: string,
    imageDataId: string,
    abortSignal?: AbortSignal,
): Promise<GetSourceResult> => {
    if (imageDataEvent.downloadSource) {
        const sourceFilePath = await downloadSourceImage(
            imageDataEvent.sourceUrl,
            tempDir,
            imageDataId,
            abortSignal,
        );
        return { sourceFilePath, errorMessage: undefined };
    }

    if (imageDataEvent.pageDataSource !== PageDataSource.Ropewiki) {
        throw new Error(
            'ImageDataEvent with downloadSource false is only supported for PageDataSource.Ropewiki',
        );
    }

    const processedImageId = imageDataEvent.existingProcessedImageId;
    if (processedImageId === undefined || processedImageId === '') {
        throw new Error(
            'getSource: existingProcessedImageId is required when downloadSource is false',
        );
    }

    const losslessBuffer = await getLosslessFile(processedImageId);
    if (losslessBuffer == null) {
        return {
            sourceFilePath: '',
            errorMessage: NO_LOSSLESS_WHEN_SKIPPING_DOWNLOAD_MESSAGE,
        };
    }

    const sourceFilePath = `${tempDir}/${imageDataId}-source-lossless.avif`;
    await writeFile(sourceFilePath, losslessBuffer);

    return { sourceFilePath, errorMessage: undefined };
};

export default getSource;
