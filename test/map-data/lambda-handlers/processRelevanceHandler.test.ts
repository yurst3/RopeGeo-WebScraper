import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mainHandler } from '../../../src/map-data/lambda-handlers/processRelevanceHandler';
import type { SqsEvent, SqsRecord } from '@aws-lambda-powertools/parser/types';

jest.mock('../../../src/map-data/sqs/handleRelevanceSQSMessages', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/sqs/setRelevanceSQSMessageVisibilityTimeout', () => ({
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

const mockHandleRelevanceSQSMessages = require('../../../src/map-data/sqs/handleRelevanceSQSMessages')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/sqs/handleRelevanceSQSMessages').default
>;
const mockSetRelevanceSQSMessageVisibilityTimeout =
    require('../../../src/map-data/sqs/setRelevanceSQSMessageVisibilityTimeout')
        .default as jest.MockedFunction<
        typeof import('../../../src/map-data/sqs/setRelevanceSQSMessageVisibilityTimeout').default
    >;

describe('processRelevanceHandler', () => {
    const mockContext = { getRemainingTimeInMillis: () => 900_000 };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS = '900';
        process.env.DEV_ENVIRONMENT = 'local';
        mockHandleRelevanceSQSMessages.mockResolvedValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });
        mockSetRelevanceSQSMessageVisibilityTimeout.mockResolvedValue(undefined);
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

        expect(mockSetRelevanceSQSMessageVisibilityTimeout).toHaveBeenCalledTimes(2);
        expect(mockSetRelevanceSQSMessageVisibilityTimeout).toHaveBeenCalledWith('rh-1');
        expect(mockSetRelevanceSQSMessageVisibilityTimeout).toHaveBeenCalledWith('rh-2');
        expect(mockHandleRelevanceSQSMessages).toHaveBeenCalledWith(
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
        expect(mockHandleRelevanceSQSMessages).not.toHaveBeenCalled();
    });

    it('returns 500 when timeout env is invalid', async () => {
        process.env.MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS = 'bad';
        const sqsEvent: SqsEvent = {
            Records: [{ body: '{}', receiptHandle: 'rh-1' } as SqsRecord],
        };

        const result = await mainHandler(sqsEvent, mockContext);

        expect(result.statusCode).toBe(500);
        expect(mockHandleRelevanceSQSMessages).not.toHaveBeenCalled();
    });
});
