import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common';
import { reprocessImagesHandler } from '../../../src/ropewiki/lambda-handlers/reprocessImagesHandler';
import { ImageDataEvent } from '../../../src/image-data/types/lambdaEvent';

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

jest.mock('../../../src/image-data/sqs/sendImageProcessorSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

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
        const images = [
            { id: 'img-1', fileUrl: 'https://ropewiki.com/images/1.jpg' },
            { id: 'img-2', fileUrl: 'https://ropewiki.com/images/2.jpg' },
        ];
        mockGetRopewikiImagesToProcess.mockResolvedValue(images);

        const result = await reprocessImagesHandler();

        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiImagesToProcess).toHaveBeenCalledWith(mockClient);
        expect(consoleLogSpy).toHaveBeenCalledWith('Enqueueing 2 RopewikiImages for image processing...');
        expect(mockSendImageProcessorSQSMessage).toHaveBeenCalledTimes(2);
        expect(mockSendImageProcessorSQSMessage).toHaveBeenNthCalledWith(
            1,
            new ImageDataEvent(PageDataSource.Ropewiki, 'img-1', 'https://ropewiki.com/images/1.jpg'),
        );
        expect(mockSendImageProcessorSQSMessage).toHaveBeenNthCalledWith(
            2,
            new ImageDataEvent(PageDataSource.Ropewiki, 'img-2', 'https://ropewiki.com/images/2.jpg'),
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

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in ReprocessRopewikiImages:', error);
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

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in ReprocessRopewikiImages:', error);
        expect(mockSendImageProcessorSQSMessage).not.toHaveBeenCalled();
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki images failed',
                error: 'Query failed',
            }),
        });
    });

    it('handles sendImageProcessorSQSMessage failure and returns 500', async () => {
        mockGetRopewikiImagesToProcess.mockResolvedValue([
            { id: 'img-1', fileUrl: 'https://ropewiki.com/images/1.jpg' },
        ]);
        mockSendImageProcessorSQSMessage.mockRejectedValue(new Error('SQS send failed'));

        const result = await reprocessImagesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in ReprocessRopewikiImages:', expect.any(Error));
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
