import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { processImageData } from '../../../src/image-data/processors/processImageData';
import ImageData from '../../../src/image-data/types/imageData';
import { Metadata } from '../../../src/image-data/types/metadata';
import ProgressLogger from '../../../src/helpers/progressLogger';

let mockDownloadSourceImage: jest.MockedFunction<typeof import('../../../src/image-data/http/downloadSourceImage').downloadSourceImage>;
let mockReadFile: jest.MockedFunction<typeof import('fs/promises').readFile>;
let mockConvertToAvif: jest.MockedFunction<typeof import('../../../src/image-data/util/convertToAvif').convertToAvif>;
let mockSaveHook: jest.MockedFunction<typeof import('../../../src/image-data/hook-functions/saveImageData').lambdaSaveImageData>;

jest.mock('../../../src/image-data/http/downloadSourceImage', () => ({
    downloadSourceImage: jest.fn(),
}));

jest.mock('fs/promises', () => ({
    mkdtemp: jest.fn().mockResolvedValue('/tmp/image-data-xyz'),
    rm: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
}));

jest.mock('../../../src/image-data/util/convertToAvif', () => ({
    convertToAvif: jest.fn(),
}));

describe('processImageData', () => {
    const sourceUrl = 'https://example.com/image.jpg';
    const previewBuffer = Buffer.from([1]);
    const bannerBuffer = Buffer.from([2]);
    const fullBuffer = Buffer.from([3]);
    const losslessBuffer = Buffer.from([4]);
    const metadata = new Metadata();
    let logger: ProgressLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        const downloadModule = require('../../../src/image-data/http/downloadSourceImage');
        mockDownloadSourceImage = downloadModule.downloadSourceImage;
        const fsModule = require('fs/promises');
        mockReadFile = fsModule.readFile;
        const convertModule = require('../../../src/image-data/util/convertToAvif');
        mockConvertToAvif = convertModule.convertToAvif;
        mockSaveHook = jest.fn();

        mockDownloadSourceImage.mockResolvedValue('/tmp/image-data-xyz/abc-source.jpg');
        mockReadFile.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]));
        mockConvertToAvif.mockResolvedValue({
            preview: previewBuffer,
            banner: bannerBuffer,
            full: fullBuffer,
            lossless: losslessBuffer,
            metadata,
        });
        mockSaveHook.mockResolvedValue(
            new ImageData(
                'https://example.com/p.avif',
                'https://example.com/b.avif',
                'https://example.com/f.avif',
                'https://example.com/l.avif',
                sourceUrl,
                undefined,
                'generated-id',
                metadata,
            ),
        );

        logger = {
            logProgress: jest.fn(),
            logError: jest.fn(),
        } as unknown as ProgressLogger;
    });

    it('downloads, converts, and calls save hook with four buffers and metadata', async () => {
        const result = await processImageData(sourceUrl, mockSaveHook, undefined, logger);

        expect(mockDownloadSourceImage).toHaveBeenCalledWith(
            sourceUrl,
            expect.any(String),
            expect.any(String),
            undefined,
        );
        expect(mockConvertToAvif).toHaveBeenCalledWith(
            expect.stringContaining('image-data-xyz'),
            undefined,
        );
        expect(mockSaveHook).toHaveBeenCalledTimes(1);
        expect(mockSaveHook).toHaveBeenCalledWith(
            expect.any(String),
            sourceUrl,
            previewBuffer,
            bannerBuffer,
            fullBuffer,
            losslessBuffer,
            metadata,
            logger,
        );
        expect(result).toBeInstanceOf(ImageData);
        expect(result.previewUrl).toBe('https://example.com/p.avif');
        expect(result.losslessUrl).toBe('https://example.com/l.avif');
    });

    it('when convertToAvif throws, returns ImageData with errorMessage', async () => {
        mockConvertToAvif.mockRejectedValue(new Error('Sharp failed'));

        const result = await processImageData(sourceUrl, mockSaveHook, 'fixed-id', logger);

        expect(mockSaveHook).not.toHaveBeenCalled();
        expect(result).toBeInstanceOf(ImageData);
        expect(result.id).toBe('fixed-id');
        expect(result.sourceUrl).toBe(sourceUrl);
        expect(result.errorMessage).toBe('Sharp failed');
        expect(result.previewUrl).toBeUndefined();
    });
});
