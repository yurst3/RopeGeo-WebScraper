import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import { ImageVersion, PageDataSource } from 'ropegeo-common';
import { processImageData } from '../../../src/image-data/processors/processImageData';
import ImageData from '../../../src/image-data/types/imageData';
import { ImageDataEvent } from '../../../src/image-data/types/lambdaEvent';
import { Metadata } from '../../../src/image-data/types/metadata';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';
import { ALL_IMAGE_VERSIONS } from '../../../src/image-data/util/imageVersionFile';

let mockGetSource: jest.MockedFunction<typeof import('../../../src/image-data/util/getSource').default>;
let mockReadFile: jest.MockedFunction<typeof import('fs/promises').readFile>;
let mockConvertSource: jest.MockedFunction<typeof import('../../../src/image-data/util/convertSource').convertSource>;
let mockSaveHook: jest.MockedFunction<typeof import('../../../src/image-data/hook-functions/saveImageData').lambdaSaveImageData>;

jest.mock('../../../src/image-data/util/getSource', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('fs/promises', () => ({
    mkdtemp: jest.fn().mockResolvedValue('/tmp/image-data-xyz'),
    rm: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
}));

jest.mock('../../../src/image-data/util/convertSource', () => ({
    convertSource: jest.fn(),
}));

jest.mock('../../../src/image-data/database/getImageDataMetadataById', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(null),
}));

jest.mock('crypto', () => ({
    randomUUID: jest.fn(() => 'generated-id'),
}));

const mockClient = {} as PoolClient;

describe('processImageData', () => {
    const event = new ImageDataEvent(
        PageDataSource.Ropewiki,
        '11111111-1111-1111-1111-111111111111',
        'https://example.com/image.jpg',
        true,
    );
    const previewBuffer = Buffer.from([1]);
    const bannerBuffer = Buffer.from([2]);
    const fullBuffer = Buffer.from([3]);
    const losslessBuffer = Buffer.from([4]);
    const linkPreviewBuffer = Buffer.from([5]);
    const metadata = new Metadata();
    const buffers = {
        [ImageVersion.preview]: previewBuffer,
        [ImageVersion.linkPreview]: linkPreviewBuffer,
        [ImageVersion.banner]: bannerBuffer,
        [ImageVersion.full]: fullBuffer,
        [ImageVersion.lossless]: losslessBuffer,
    };
    let logger: ProgressLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSource = require('../../../src/image-data/util/getSource').default;
        const fsModule = require('fs/promises');
        mockReadFile = fsModule.readFile;
        const convertModule = require('../../../src/image-data/util/convertSource');
        mockConvertSource = convertModule.convertSource;
        mockSaveHook = jest.fn();

        mockGetSource.mockResolvedValue({
            sourceFilePath: '/tmp/image-data-xyz/abc-source.jpg',
            errorMessage: undefined,
        });
        mockReadFile.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]));
        mockConvertSource.mockResolvedValue({
            buffers,
            metadata,
        });
        mockSaveHook.mockResolvedValue(
            new ImageData(
                'https://example.com/p.avif',
                'https://example.com/b.avif',
                'https://example.com/f.avif',
                'https://example.com/l.avif',
                'https://example.com/lp.jpg',
                event.sourceUrl,
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

    it('resolves source, converts, and calls save hook with buffers map and metadata', async () => {
        const result = await processImageData(event, mockSaveHook, logger, 'generated-id', mockClient);

        expect(mockGetSource).toHaveBeenCalledWith(
            event,
            expect.any(String),
            expect.any(String),
            undefined,
        );
        expect(mockConvertSource).toHaveBeenCalledWith(
            '/tmp/image-data-xyz/abc-source.jpg',
            ALL_IMAGE_VERSIONS,
            undefined,
            undefined,
        );
        expect(mockSaveHook).toHaveBeenCalledTimes(1);
        expect(mockSaveHook).toHaveBeenCalledWith(
            'generated-id',
            event.sourceUrl,
            buffers,
            metadata,
            logger,
        );
        expect(result).toBeInstanceOf(ImageData);
        expect(result.previewUrl).toBe('https://example.com/p.avif');
        expect(result.losslessUrl).toBe('https://example.com/l.avif');
        expect(result.linkPreviewUrl).toBe('https://example.com/lp.jpg');
    });

    it('when convertSource throws, returns ImageData with errorMessage', async () => {
        mockConvertSource.mockRejectedValue(new Error('Sharp failed'));

        const result = await processImageData(event, mockSaveHook, logger, 'generated-id', mockClient);

        expect(mockSaveHook).not.toHaveBeenCalled();
        expect(result).toBeInstanceOf(ImageData);
        expect(result.id).toBe('generated-id');
        expect(result.sourceUrl).toBe(event.sourceUrl);
        expect(result.errorMessage).toBe('Sharp failed');
        expect(result.previewUrl).toBeUndefined();
    });

    it('returns canonical error and undefined urls when getSource reports no source', async () => {
        const noDownloadEvent = new ImageDataEvent(
            PageDataSource.Ropewiki,
            '11111111-1111-1111-1111-111111111111',
            'https://example.com/image.jpg',
            false,
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
        );
        mockGetSource.mockResolvedValue({
            sourceFilePath: '',
            errorMessage: 'No lossless image available when downloadSource is False',
        });

        const result = await processImageData(
            noDownloadEvent,
            mockSaveHook,
            logger,
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            mockClient,
        );

        expect(mockReadFile).not.toHaveBeenCalled();
        expect(mockConvertSource).not.toHaveBeenCalled();
        expect(mockSaveHook).not.toHaveBeenCalled();
        expect(result.id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
        expect(result.errorMessage).toBe('No lossless image available when downloadSource is False');
        expect(result.previewUrl).toBeUndefined();
        expect(result.sourceUrl).toBe(noDownloadEvent.sourceUrl);
    });

    it('uses existingProcessedImageId as imageDataId when provided on event', async () => {
        const eventWithExistingId = new ImageDataEvent(
            PageDataSource.Ropewiki,
            '11111111-1111-1111-1111-111111111111',
            'https://example.com/image.jpg',
            false,
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
        );

        await processImageData(
            eventWithExistingId,
            mockSaveHook,
            logger,
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            mockClient,
        );

        expect(mockGetSource).toHaveBeenCalledWith(
            eventWithExistingId,
            expect.any(String),
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            undefined,
        );
    });
});
