import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mainHandler } from '../../../src/image-data/lambda-handlers/mainHandler';
import { PageDataSource } from 'ropegeo-common/models';
import type { SqsEvent, SqsRecord } from '@aws-lambda-powertools/parser/types';

let mockHandleImageProcessorSQSMessages: jest.MockedFunction<typeof import('../../../src/image-data/sqs/handleImageProcessorSQSMessages').default>;
let mockSetImageProcessorSQSMessageVisibilityTimeout: jest.MockedFunction<typeof import('../../../src/image-data/sqs/setImageProcessorSQSMessageVisibilityTimeout').default>;

jest.mock('../../../src/image-data/sqs/handleImageProcessorSQSMessages', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/image-data/sqs/setImageProcessorSQSMessageVisibilityTimeout', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve()),
}));

const mockClient = {
    release: jest.fn(),
} as any;

const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    end: jest.fn(() => Promise.resolve()),
} as any;

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(mockPool)),
}));

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    ProgressLogger: jest.fn().mockImplementation(() => ({
        setChunk: jest.fn(),
        logProgress: jest.fn(),
        logError: jest.fn(),
        getResults: jest.fn(),
    })),
}));

const mockContext = { getRemainingTimeInMillis: () => 900_000 };

describe('ImageProcessor mainHandler', () => {
    const pageImageId = '11111111-1111-1111-1111-111111111111';
    const source = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';
    const pageDataSource = PageDataSource.Ropewiki;
    const imageRecordBody = { pageDataSource, pageImageId, sourceUrl: source, downloadSource: true };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS = '300';

        const handleModule = require('../../../src/image-data/sqs/handleImageProcessorSQSMessages');
        mockHandleImageProcessorSQSMessages = handleModule.default;
        mockSetImageProcessorSQSMessageVisibilityTimeout = require('../../../src/image-data/sqs/setImageProcessorSQSMessageVisibilityTimeout').default;

        mockSetImageProcessorSQSMessageVisibilityTimeout.mockResolvedValue(undefined);
        mockHandleImageProcessorSQSMessages.mockResolvedValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });
    });

    it('successfully processes valid SQS event', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify(imageRecordBody),
                    receiptHandle: 'test-receipt-handle',
                } as SqsRecord,
            ],
        };

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockHandleImageProcessorSQSMessages).toHaveBeenCalledWith(
            sqsEvent.Records,
            expect.any(Object),
            300_000,
            expect.any(Function),
        );
        expect(result).toEqual({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Processed image data for 1 message(s)',
                results: { successes: 1, errors: 0, remaining: 0 },
            }),
        });
    });

    it('returns error when SQS event is missing Records', async () => {
        const sqsEvent = {} as SqsEvent;

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockHandleImageProcessorSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process image data');
        expect(body.error).toBe('Invalid SQS event: missing Records array or empty Records');
    });

    it('returns error when SQS event Records is empty', async () => {
        const sqsEvent: SqsEvent = { Records: [] };

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockHandleImageProcessorSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.error).toBe('Invalid SQS event: missing Records array or empty Records');
    });

    it('returns 500 when IMAGE_PROCESSOR_TIMEOUT_SECONDS is invalid', async () => {
        const previous = process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS;
        delete process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS;
        const sqsEvent: SqsEvent = {
            Records: [
                { body: JSON.stringify(imageRecordBody), receiptHandle: 'h' } as SqsRecord,
            ],
        };

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockHandleImageProcessorSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain('IMAGE_PROCESSOR_TIMEOUT_SECONDS');
        if (previous !== undefined) process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS = previous;
    });

    it('returns 500 when getRemainingTimeInMillis is missing', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                { body: JSON.stringify(imageRecordBody), receiptHandle: 'h' } as SqsRecord,
            ],
        };

        const result = await mainHandler(sqsEvent, {});

        expect(mockHandleImageProcessorSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain('getRemainingTimeInMillis');
    });

    it('returns 500 when handleImageProcessorSQSMessages throws', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                { body: JSON.stringify(imageRecordBody), receiptHandle: 'h' } as SqsRecord,
            ],
        };
        mockHandleImageProcessorSQSMessages.mockRejectedValue(new Error('Download failed'));

        const result = await mainHandler(sqsEvent, mockContext);

        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process image data');
        expect(body.error).toBe('Download failed');
    });

    it('calls setImageProcessorSQSMessageVisibilityTimeout for each record before processing', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                { body: JSON.stringify(imageRecordBody), receiptHandle: 'handle-1' } as SqsRecord,
                {
                    body: JSON.stringify({
                        pageDataSource,
                        pageImageId: '22222222-2222-2222-2222-222222222222',
                        sourceUrl: source,
                        downloadSource: true,
                    }),
                    receiptHandle: 'handle-2',
                } as SqsRecord,
            ],
        };

        await mainHandler(sqsEvent, mockContext);

        expect(mockSetImageProcessorSQSMessageVisibilityTimeout).toHaveBeenCalledTimes(2);
        expect(mockSetImageProcessorSQSMessageVisibilityTimeout).toHaveBeenNthCalledWith(1, 'handle-1');
        expect(mockSetImageProcessorSQSMessageVisibilityTimeout).toHaveBeenNthCalledWith(2, 'handle-2');
        expect(mockHandleImageProcessorSQSMessages).toHaveBeenCalledWith(
            sqsEvent.Records,
            expect.any(Object),
            300_000,
            expect.any(Function),
        );
    });
});
