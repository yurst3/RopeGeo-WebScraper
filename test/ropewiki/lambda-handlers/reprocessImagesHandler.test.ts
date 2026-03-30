import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ImageVersion, PageDataSource } from 'ropegeo-common';
import { reprocessImagesHandler } from '../../../src/ropewiki/lambda-handlers/reprocessImagesHandler';
import { ImageDataEvent } from '../../../src/image-data/types/lambdaEvent';
import { RopewikiImage } from '../../../src/ropewiki/types/image';

function makeRopewikiImage(partial: { id: string; fileUrl: string; processedImage: string | null }) {
    const img = new RopewikiImage(undefined, 'https://ropewiki.com/link', partial.fileUrl, undefined, 1);
    img.id = partial.id;
    img.processedImage = partial.processedImage;
    return img;
}

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetRopewikiImagesToProcess: jest.MockedFunction<typeof import('../../../src/ropewiki/database/getRopewikiImagesToProcess').default>;
let mockSendImageProcessorSQSMessage: jest.MockedFunction<typeof import('../../../src/image-data/sqs/sendImageProcessorSQSMessage').default>;

let mockClient: { release: ReturnType<typeof jest.fn> };
let mockPool: { connect: ReturnType<typeof jest.fn>; end: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/ropewiki/database/getRopewikiImagesToProcess', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/image-data/sqs/sendImageProcessorSQSMessage', () => {
    const actual = jest.requireActual<
        typeof import('../../../src/image-data/sqs/sendImageProcessorSQSMessage')
    >('../../../src/image-data/sqs/sendImageProcessorSQSMessage');
    return {
        __esModule: true,
        serializeImageDataEventForQueue: actual.serializeImageDataEventForQueue,
        default: jest.fn(),
    };
});

let consoleLogSpy: ReturnType<typeof jest.spyOn>;
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('reprocessImagesHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
            end: jest.fn().mockResolvedValue(undefined),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockGetRopewikiImagesToProcess = require('../../../src/ropewiki/database/getRopewikiImagesToProcess').default;
        mockSendImageProcessorSQSMessage = require('../../../src/image-data/sqs/sendImageProcessorSQSMessage').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetRopewikiImagesToProcess.mockResolvedValue([]);
        mockSendImageProcessorSQSMessage.mockResolvedValue(undefined);
    });

    it('gets connection, fetches images to process, sends SQS message for each, and returns 200', async () => {
        mockGetRopewikiImagesToProcess.mockResolvedValue([
            makeRopewikiImage({ id: 'img-1', fileUrl: 'https://ropewiki.com/images/1.jpg', processedImage: null }),
            makeRopewikiImage({ id: 'img-2', fileUrl: 'https://ropewiki.com/images/2.jpg', processedImage: null }),
        ]);

        const result = await reprocessImagesHandler();

        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiImagesToProcess).toHaveBeenCalledWith(mockClient, true, true);
        expect(consoleLogSpy).toHaveBeenCalledWith('Enqueueing 2 RopewikiImages for image processing...');
        expect(mockSendImageProcessorSQSMessage).toHaveBeenCalledTimes(2);
        expect(mockSendImageProcessorSQSMessage).toHaveBeenNthCalledWith(
            1,
            new ImageDataEvent(PageDataSource.Ropewiki, 'img-1', 'https://ropewiki.com/images/1.jpg', true),
        );
        expect(mockSendImageProcessorSQSMessage).toHaveBeenNthCalledWith(
            2,
            new ImageDataEvent(PageDataSource.Ropewiki, 'img-2', 'https://ropewiki.com/images/2.jpg', true),
        );
        expect(result).toEqual({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki images completed successfully',
                enqueuedCount: 2,
            }),
        });
    });

    it('returns 200 with enqueuedCount 0 when no images to process', async () => {
        mockGetRopewikiImagesToProcess.mockResolvedValue([]);

        const result = await reprocessImagesHandler();

        expect(mockGetRopewikiImagesToProcess).toHaveBeenCalledWith(mockClient, true, true);
        expect(consoleLogSpy).toHaveBeenCalledWith('Enqueueing 0 RopewikiImages for image processing...');
        expect(mockSendImageProcessorSQSMessage).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).enqueuedCount).toBe(0);
    });

    it('releases client and ends pool on success', async () => {
        await reprocessImagesHandler();

        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('handles getDatabaseConnection failure and returns 500', async () => {
        const error = new Error('Connection failed');
        mockGetDatabaseConnection.mockRejectedValue(error);

        const result = await reprocessImagesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in RopewikiImageReprocessor:', error);
        expect(mockGetRopewikiImagesToProcess).not.toHaveBeenCalled();
        expect(mockSendImageProcessorSQSMessage).not.toHaveBeenCalled();
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki images failed',
                error: 'Connection failed',
            }),
        });
    });

    it('handles getRopewikiImagesToProcess failure and returns 500', async () => {
        const error = new Error('Query failed');
        mockGetRopewikiImagesToProcess.mockRejectedValue(error);

        const result = await reprocessImagesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in RopewikiImageReprocessor:', error);
        expect(mockSendImageProcessorSQSMessage).not.toHaveBeenCalled();
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki images failed',
                error: 'Query failed',
            }),
        });
    });

    it('passes onlyUnprocessed from event body', async () => {
        await reprocessImagesHandler({
            body: JSON.stringify({ onlyUnprocessed: false }),
        });
        expect(mockGetRopewikiImagesToProcess).toHaveBeenCalledWith(mockClient, false, true);
    });

    it('passes versions from event body into ImageDataEvent', async () => {
        mockGetRopewikiImagesToProcess.mockResolvedValue([
            makeRopewikiImage({ id: 'img-1', fileUrl: 'https://ropewiki.com/images/1.jpg', processedImage: null }),
        ]);
        await reprocessImagesHandler({
            body: JSON.stringify({ versions: [ImageVersion.linkPreview] }),
        });
        expect(mockSendImageProcessorSQSMessage).toHaveBeenCalledWith(
            new ImageDataEvent(
                PageDataSource.Ropewiki,
                'img-1',
                'https://ropewiki.com/images/1.jpg',
                true,
                undefined,
                [ImageVersion.linkPreview],
            ),
        );
    });

    it('passes downloadSource into ImageDataEvent', async () => {
        mockGetRopewikiImagesToProcess.mockResolvedValue([
            makeRopewikiImage({
                id: 'img-1',
                fileUrl: 'https://ropewiki.com/images/1.jpg',
                processedImage: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            }),
        ]);
        await reprocessImagesHandler({
            body: JSON.stringify({ downloadSource: false, onlyUnprocessed: false }),
        });
        expect(mockGetRopewikiImagesToProcess).toHaveBeenCalledWith(mockClient, false, false);
        expect(mockSendImageProcessorSQSMessage).toHaveBeenCalledWith(
            new ImageDataEvent(
                PageDataSource.Ropewiki,
                'img-1',
                'https://ropewiki.com/images/1.jpg',
                false,
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            ),
        );
    });

    it('returns 400 when downloadSource is false and onlyUnprocessed is true', async () => {
        const result = await reprocessImagesHandler({
            body: JSON.stringify({ downloadSource: false, onlyUnprocessed: true }),
        });
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Invalid ReprocessImagesEvent');
        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
    });

    it('returns 400 when event body is invalid JSON', async () => {
        const result = await reprocessImagesHandler({ body: '{' });
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Invalid ReprocessImagesEvent');
    });

    it('handles sendImageProcessorSQSMessage failure and returns 500', async () => {
        mockGetRopewikiImagesToProcess.mockResolvedValue([
            makeRopewikiImage({ id: 'img-1', fileUrl: 'https://ropewiki.com/images/1.jpg', processedImage: null }),
        ]);
        mockSendImageProcessorSQSMessage.mockRejectedValue(new Error('SQS send failed'));

        const result = await reprocessImagesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in RopewikiImageReprocessor:', expect.any(Error));
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toBe('SQS send failed');
    });

    it('releases client and ends pool on error', async () => {
        mockGetRopewikiImagesToProcess.mockRejectedValue(new Error('Query failed'));

        await reprocessImagesHandler();

        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(mockPool.end).toHaveBeenCalledTimes(1);
    });
});
