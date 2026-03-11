import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { main } from '../../src/image-data/main';
import { PageDataSource } from 'ropegeo-common';
import { ImageDataEvent } from '../../src/image-data/types/lambdaEvent';
import ImageData from '../../src/image-data/types/imageData';
import type { SaveImageDataHookFn } from '../../src/image-data/hook-functions/saveImageData';
import ProgressLogger from '../../src/helpers/progressLogger';

let mockProcessImageData: jest.MockedFunction<typeof import('../../src/image-data/processors/processImageData').processImageData>;
let mockUpsertImageData: jest.MockedFunction<typeof import('../../src/image-data/database/upsertImageData').default>;
let mockUpdateProcessedImageForSource: jest.MockedFunction<typeof import('../../src/image-data/util/updateProcessedImageForSource').default>;

jest.mock('../../src/image-data/processors/processImageData', () => ({
    processImageData: jest.fn(),
}));

jest.mock('../../src/image-data/database/upsertImageData', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../src/image-data/util/updateProcessedImageForSource', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const mockClient = {} as any;

describe('image-data main', () => {
    const event = new ImageDataEvent(
        PageDataSource.Ropewiki,
        '11111111-1111-1111-1111-111111111111',
        'https://example.com/image.jpg',
    );
    const mockSaveImageDataHookFn = jest.fn<SaveImageDataHookFn>();
    let logger: ProgressLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        const processImageDataModule = require('../../src/image-data/processors/processImageData');
        mockProcessImageData = processImageDataModule.processImageData;
        const upsertImageDataModule = require('../../src/image-data/database/upsertImageData');
        mockUpsertImageData = upsertImageDataModule.default;
        const updateProcessedImageForSourceModule = require('../../src/image-data/util/updateProcessedImageForSource');
        mockUpdateProcessedImageForSource = updateProcessedImageForSourceModule.default;

        logger = new ProgressLogger('Test', 1);
        logger.setChunk(0, 1);

        const imageData = new ImageData(
            'https://example.com/preview.avif',
            'https://example.com/banner.avif',
            'https://example.com/full.avif',
            event.source,
            undefined,
            undefined,
        );
        mockProcessImageData.mockResolvedValue(imageData);

        const upserted = new ImageData(
            imageData.previewUrl,
            imageData.bannerUrl,
            imageData.fullUrl,
            imageData.sourceUrl,
            undefined,
            '22222222-2222-2222-2222-222222222222',
        );
        mockUpsertImageData.mockResolvedValue(upserted);
        mockUpdateProcessedImageForSource.mockResolvedValue(undefined);
    });

    it('calls processImageData then upsertImageData and updateProcessedImageForSource when no abortSignal', async () => {
        await main(event, mockSaveImageDataHookFn, logger, mockClient);

        expect(mockProcessImageData).toHaveBeenCalledWith(
            event.source,
            mockSaveImageDataHookFn,
            undefined,
            logger,
            undefined,
        );
        expect(mockUpsertImageData).toHaveBeenCalledWith(mockClient, expect.any(ImageData));
        expect(mockUpdateProcessedImageForSource).toHaveBeenCalledWith(
            mockClient,
            event.pageDataSource,
            event.id,
            '22222222-2222-2222-2222-222222222222',
        );
    });

    it('calls upsertImageData and updateProcessedImageForSource when abortSignal provided but not aborted', async () => {
        const controller = new AbortController();
        mockProcessImageData.mockResolvedValue(
            new ImageData('p', 'b', 'f', event.source, undefined, 'img-id'),
        );
        mockUpsertImageData.mockResolvedValue(
            new ImageData('p', 'b', 'f', event.source, undefined, 'img-id'),
        );

        await main(event, mockSaveImageDataHookFn, logger, mockClient, controller.signal);

        expect(mockUpsertImageData).toHaveBeenCalled();
        expect(mockUpdateProcessedImageForSource).toHaveBeenCalled();
    });

    it('does not call upsertImageData or updateProcessedImageForSource when abortSignal is aborted after processImageData returns', async () => {
        const controller = new AbortController();
        mockProcessImageData.mockImplementation(async () => {
            controller.abort(new Error('Timed out'));
            return new ImageData('p', 'b', 'f', event.source, undefined, undefined);
        });

        await expect(
            main(event, mockSaveImageDataHookFn, logger, mockClient, controller.signal),
        ).rejects.toThrow('Timed out');

        expect(mockUpsertImageData).not.toHaveBeenCalled();
        expect(mockUpdateProcessedImageForSource).not.toHaveBeenCalled();
    });

    it('throws and does not persist when abortSignal was already aborted before main', async () => {
        const controller = new AbortController();
        controller.abort(new Error('Already aborted'));

        await expect(
            main(event, mockSaveImageDataHookFn, logger, mockClient, controller.signal),
        ).rejects.toThrow('Already aborted');

        expect(mockProcessImageData).toHaveBeenCalled();
        expect(mockUpsertImageData).not.toHaveBeenCalled();
        expect(mockUpdateProcessedImageForSource).not.toHaveBeenCalled();
    });

    it('does not call upsert or update when processImageData throws', async () => {
        mockProcessImageData.mockRejectedValue(new Error('Download failed'));

        await expect(
            main(event, mockSaveImageDataHookFn, logger, mockClient),
        ).rejects.toThrow('Download failed');

        expect(mockUpsertImageData).not.toHaveBeenCalled();
        expect(mockUpdateProcessedImageForSource).not.toHaveBeenCalled();
    });

    it('throws when upsertImageData returns ImageData without id', async () => {
        mockUpsertImageData.mockResolvedValue(
            new ImageData('p', 'b', 'f', event.source, undefined, undefined),
        );

        await expect(
            main(event, mockSaveImageDataHookFn, logger, mockClient),
        ).rejects.toThrow('upsertImageData returned ImageData without id');

        expect(mockUpdateProcessedImageForSource).not.toHaveBeenCalled();
    });
});
