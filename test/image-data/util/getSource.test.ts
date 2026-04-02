import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/classes';
import { ImageDataEvent } from '../../../src/image-data/types/lambdaEvent';
import getSource, {
    NO_LOSSLESS_WHEN_SKIPPING_DOWNLOAD_MESSAGE,
} from '../../../src/image-data/util/getSource';

let mockDownloadSourceImage: jest.MockedFunction<
    typeof import('../../../src/image-data/http/downloadSourceImage').downloadSourceImage
>;
let mockGetLosslessFile: jest.MockedFunction<typeof import('../../../src/image-data/s3/getLosslessFile').default>;
let mockWriteFile: jest.MockedFunction<typeof import('fs/promises').writeFile>;

jest.mock('../../../src/image-data/http/downloadSourceImage', () => ({
    downloadSourceImage: jest.fn(),
}));

jest.mock('../../../src/image-data/s3/getLosslessFile', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}));

describe('getSource', () => {
    const tempDir = '/tmp/image-data-xyz';
    const imageDataId = '99999999-9999-9999-9999-999999999999';
    const existingId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    beforeEach(() => {
        jest.clearAllMocks();
        mockDownloadSourceImage = require('../../../src/image-data/http/downloadSourceImage').downloadSourceImage;
        mockGetLosslessFile = require('../../../src/image-data/s3/getLosslessFile').default;
        mockWriteFile = require('fs/promises').writeFile;
    });

    it('when downloadSource is true, downloads source and returns source path + URL', async () => {
        const event = new ImageDataEvent(
            PageDataSource.Ropewiki,
            '11111111-1111-1111-1111-111111111111',
            'https://example.com/source.jpg',
            true,
        );
        mockDownloadSourceImage.mockResolvedValue('/tmp/image-data-xyz/downloaded.jpg');

        const result = await getSource(event, tempDir, imageDataId);

        expect(mockDownloadSourceImage).toHaveBeenCalledWith(
            event.sourceUrl,
            tempDir,
            imageDataId,
            undefined,
        );
        expect(result).toEqual({
            sourceFilePath: '/tmp/image-data-xyz/downloaded.jpg',
            errorMessage: undefined,
        });
    });

    it('when downloadSource is false, fetches lossless from S3 and writes temp file', async () => {
        const event = new ImageDataEvent(
            PageDataSource.Ropewiki,
            '11111111-1111-1111-1111-111111111111',
            'https://example.com/source.jpg',
            false,
            existingId,
        );
        mockGetLosslessFile.mockResolvedValue(Buffer.from([1, 2, 3]));

        const result = await getSource(event, tempDir, imageDataId);

        expect(mockGetLosslessFile).toHaveBeenCalledWith(existingId);
        expect(mockWriteFile).toHaveBeenCalledWith(
            `${tempDir}/${imageDataId}-source-lossless.avif`,
            Buffer.from([1, 2, 3]),
        );
        expect(result).toEqual({
            sourceFilePath: `${tempDir}/${imageDataId}-source-lossless.avif`,
            errorMessage: undefined,
        });
    });

    it('returns canonical error when lossless image is missing in S3', async () => {
        const event = new ImageDataEvent(
            PageDataSource.Ropewiki,
            '11111111-1111-1111-1111-111111111111',
            'https://example.com/source.jpg',
            false,
            existingId,
        );
        mockGetLosslessFile.mockResolvedValue(null);

        const result = await getSource(event, tempDir, imageDataId);

        expect(result).toEqual({
            sourceFilePath: '',
            errorMessage: NO_LOSSLESS_WHEN_SKIPPING_DOWNLOAD_MESSAGE,
        });
    });

    it('throws when downloadSource is false and pageDataSource is unsupported', async () => {
        const event = new ImageDataEvent(
            PageDataSource.Ropewiki,
            '11111111-1111-1111-1111-111111111111',
            'https://example.com/source.jpg',
            false,
            existingId,
        );
        (event as { pageDataSource: string }).pageDataSource = 'unsupported-source';

        await expect(getSource(event, tempDir, imageDataId)).rejects.toThrow(
            'ImageDataEvent with downloadSource false is only supported for PageDataSource.Ropewiki',
        );
    });
});
