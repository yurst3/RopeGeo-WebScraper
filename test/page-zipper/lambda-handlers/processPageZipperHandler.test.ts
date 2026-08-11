import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mainHandler } from '../../../src/page-zipper/lambda-handlers/processPageZipperHandler';
import type { SqsEvent, SqsRecord } from '@aws-lambda-powertools/parser/types';

jest.mock('../../../src/page-zipper/sqs/handlePageZipperSQSMessages', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/page-zipper/sqs/setPageZipperSQSMessageVisibilityTimeout', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve()),
}));

const mockClient = { release: jest.fn() } as any;
const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
} as any;

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(mockPool)),
}));

const mockHandlePageZipperSQSMessages = require('../../../src/page-zipper/sqs/handlePageZipperSQSMessages')
    .default as jest.MockedFunction<
    typeof import('../../../src/page-zipper/sqs/handlePageZipperSQSMessages').default
>;
const mockSetPageZipperSQSMessageVisibilityTimeout =
    require('../../../src/page-zipper/sqs/setPageZipperSQSMessageVisibilityTimeout')
        .default as jest.MockedFunction<
        typeof import('../../../src/page-zipper/sqs/setPageZipperSQSMessageVisibilityTimeout').default
    >;

describe('processPageZipperHandler', () => {
    const mockContext = { getRemainingTimeInMillis: () => 900_000 };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS = '900';
        process.env.DEV_ENVIRONMENT = 'local';
        mockHandlePageZipperSQSMessages.mockResolvedValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });
        mockSetPageZipperSQSMessageVisibilityTimeout.mockResolvedValue(undefined);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('sets visibility, handles records, and returns 200', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                { body: '{}', receiptHandle: 'rh-1' } as SqsRecord,
                { body: '{}', receiptHandle: 'rh-2' } as SqsRecord,
            ],
        };

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockSetPageZipperSQSMessageVisibilityTimeout).toHaveBeenCalledTimes(2);
        expect(mockHandlePageZipperSQSMessages).toHaveBeenCalledWith(
            sqsEvent.Records,
            mockClient,
            900_000,
            expect.any(Function),
        );
        expect(result.statusCode).toBe(200);
        expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns 500 when getRemainingTimeInMillis is missing', async () => {
        const sqsEvent: SqsEvent = {
            Records: [{ body: '{}', receiptHandle: 'rh-1' } as SqsRecord],
        };

        const result = await mainHandler(sqsEvent, {});

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain('getRemainingTimeInMillis is required');
        expect(mockHandlePageZipperSQSMessages).not.toHaveBeenCalled();
    });

    it('returns 500 when timeout env is invalid', async () => {
        process.env.PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS = 'bad';
        const sqsEvent: SqsEvent = {
            Records: [{ body: '{}', receiptHandle: 'rh-1' } as SqsRecord],
        };

        const result = await mainHandler(sqsEvent, mockContext);

        expect(result.statusCode).toBe(500);
        expect(mockHandlePageZipperSQSMessages).not.toHaveBeenCalled();
    });
});
