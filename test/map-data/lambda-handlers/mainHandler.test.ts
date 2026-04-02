import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mainHandler } from '../../../src/map-data/lambda-handlers/mainHandler';
import { PageDataSource } from 'ropegeo-common/classes';
import { MapDataEvent } from '../../../src/map-data/types/lambdaEvent';
import type { SqsEvent, SqsRecord } from '@aws-lambda-powertools/parser/types';

// Mock handleMapDataSQSMessages and setMapDataSQSMessageVisibilityTimeout
let mockHandleMapDataSQSMessages: jest.MockedFunction<typeof import('../../../src/map-data/sqs/handleMapDataSQSMessages').default>;
let mockSetMapDataSQSMessageVisibilityTimeout: jest.MockedFunction<typeof import('../../../src/map-data/sqs/setMapDataSQSMessageVisibilityTimeout').default>;
jest.mock('../../../src/map-data/sqs/handleMapDataSQSMessages', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/sqs/setMapDataSQSMessageVisibilityTimeout', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve()),
}));

// Mock database connection
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

// Mock MapDataEvent (still needed for creating test instances)
jest.mock('../../../src/map-data/types/lambdaEvent', () => {
    // Create a mock class that matches the MapDataEvent interface
    class MockedMapDataEvent {
        source: any;
        routeId: string;
        pageId: string;
        mapDataId: string | undefined;
        
        constructor(source: any, routeId: string, pageId: string, mapDataId?: string) {
            this.source = source;
            this.routeId = routeId;
            this.pageId = pageId;
            this.mapDataId = mapDataId;
        }
    }
    return {
        MapDataEvent: MockedMapDataEvent,
        default: MockedMapDataEvent,
    };
});

const mockContext = { getRemainingTimeInMillis: () => 900_000 };

describe('mainHandler', () => {
    const routeId = '11111111-1111-1111-1111-111111111111';
    const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
    const source = PageDataSource.Ropewiki;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS = '900';

        // Set DEV_ENVIRONMENT to 'local' to skip SQS calls
        process.env.DEV_ENVIRONMENT = 'local';
        
        // Setup mocks
        const handleMapDataSQSMessagesModule = require('../../../src/map-data/sqs/handleMapDataSQSMessages');
        mockHandleMapDataSQSMessages = handleMapDataSQSMessagesModule.default;
        mockSetMapDataSQSMessageVisibilityTimeout = require('../../../src/map-data/sqs/setMapDataSQSMessageVisibilityTimeout').default;

        mockSetMapDataSQSMessageVisibilityTimeout.mockResolvedValue(undefined);
        mockHandleMapDataSQSMessages.mockResolvedValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });
    });

    it('successfully processes valid SQS event', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                    receiptHandle: 'test-receipt-handle',
                } as SqsRecord,
            ],
        };

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockHandleMapDataSQSMessages).toHaveBeenCalledWith(
            sqsEvent.Records,
            expect.any(Object),
            900_000,
            expect.any(Function),
        );
        expect(result).toEqual({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Processed map data for 1 page routes',
                results: {
                    successes: 1,
                    errors: 0,
                    remaining: 0,
                },
            }),
        });
    });

    it('returns error when SQS event is missing Records', async () => {
        const sqsEvent = {} as SqsEvent;

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockSetMapDataSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
        expect(mockHandleMapDataSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('Invalid SQS event: missing Records array or empty Records');
    });

    it('returns error when SQS event Records is not an array', async () => {
        const sqsEvent = {
            Records: 'not-an-array',
        } as any;

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockSetMapDataSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
        expect(mockHandleMapDataSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('Invalid SQS event: missing Records array or empty Records');
    });

    it('returns error when SQS event Records is empty', async () => {
        const sqsEvent: SqsEvent = {
            Records: [],
        };

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockSetMapDataSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
        expect(mockHandleMapDataSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('Invalid SQS event: missing Records array or empty Records');
    });

    it('returns 500 and skips handleMapDataSQSMessages when MAP_DATA_PROCESSOR_TIMEOUT_SECONDS is invalid', async () => {
        const previous = process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS;
        delete process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS;
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({ source, routeId, pageId }),
                    receiptHandle: 'test-receipt-handle',
                } as SqsRecord,
            ],
        };

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockHandleMapDataSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toContain('Invalid MAP_DATA_PROCESSOR_TIMEOUT_SECONDS');
        if (previous !== undefined) process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS = previous;
    });

    it('returns 500 and skips handleMapDataSQSMessages when getRemainingTimeInMillis is null', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({ source, routeId, pageId }),
                    receiptHandle: 'test-receipt-handle',
                } as SqsRecord,
            ],
        };

        const result = await mainHandler(sqsEvent, {});

        expect(mockHandleMapDataSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toContain('getRemainingTimeInMillis is required');
    });

    it('returns error when handleMapDataSQSMessages throws', async () => {
        const error = new Error('SQS record missing body');
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                    receiptHandle: 'test-receipt-handle',
                } as SqsRecord,
            ],
        };

        mockHandleMapDataSQSMessages.mockRejectedValue(error);

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockHandleMapDataSQSMessages).toHaveBeenCalledWith(
            sqsEvent.Records,
            expect.any(Object),
            900_000,
            expect.any(Function),
        );
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('SQS record missing body');
    });


    it('returns error when handleMapDataSQSMessages throws', async () => {
        const error = new Error('Database connection failed');
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                    receiptHandle: 'test-receipt-handle',
                } as SqsRecord,
            ],
        };

        mockHandleMapDataSQSMessages.mockRejectedValue(error);

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockHandleMapDataSQSMessages).toHaveBeenCalledWith(
            sqsEvent.Records,
            expect.any(Object),
            900_000,
            expect.any(Function),
        );
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('Database connection failed');
    });

    it('handles non-Error exceptions from handleMapDataSQSMessages', async () => {
        const error = 'String error';
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                    receiptHandle: 'test-receipt-handle',
                } as SqsRecord,
            ],
        };

        mockHandleMapDataSQSMessages.mockRejectedValue(error);

        const result = await mainHandler(sqsEvent, mockContext);

        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('String error');
    });

    it('processes all records when multiple records exist', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                    receiptHandle: 'test-receipt-handle-1',
                } as SqsRecord,
                {
                    body: JSON.stringify({
                        source,
                        routeId: '22222222-2222-2222-2222-222222222222',
                        pageId: '33333333-3333-3333-3333-333333333333',
                    }),
                    receiptHandle: 'test-receipt-handle-2',
                } as SqsRecord,
            ],
        };

        mockHandleMapDataSQSMessages.mockResolvedValue({
            successes: 2,
            errors: 0,
            remaining: 0,
        });

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockSetMapDataSQSMessageVisibilityTimeout).toHaveBeenCalledTimes(2);
        expect(mockSetMapDataSQSMessageVisibilityTimeout).toHaveBeenNthCalledWith(1, 'test-receipt-handle-1');
        expect(mockSetMapDataSQSMessageVisibilityTimeout).toHaveBeenNthCalledWith(2, 'test-receipt-handle-2');
        expect(mockHandleMapDataSQSMessages).toHaveBeenCalledTimes(1);
        expect(mockHandleMapDataSQSMessages).toHaveBeenCalledWith(
            sqsEvent.Records,
            expect.any(Object),
            900_000,
            expect.any(Function),
        );
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Processed map data for 2 page routes');
        expect(body.results).toEqual({
            successes: 2,
            errors: 0,
            remaining: 0,
        });
    });

    it('calls setMapDataSQSMessageVisibilityTimeout before handleMapDataSQSMessages', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({ source, routeId, pageId }),
                    receiptHandle: 'receipt-1',
                } as SqsRecord,
            ],
        };
        const callOrder: string[] = [];
        mockSetMapDataSQSMessageVisibilityTimeout.mockImplementation(async () => {
            callOrder.push('visibility');
        });
        mockHandleMapDataSQSMessages.mockImplementation(async () => {
            callOrder.push('handle');
            return { successes: 1, errors: 0, remaining: 0 };
        });

        await mainHandler(sqsEvent, mockContext);

        expect(callOrder).toEqual(['visibility', 'handle']);
    });

    it('calls handleMapDataSQSMessages with records and client', async () => {
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                    receiptHandle: 'test-receipt-handle',
                } as SqsRecord,
            ],
        };

        await mainHandler(sqsEvent, mockContext);

        expect(mockHandleMapDataSQSMessages).toHaveBeenCalledWith(
            sqsEvent.Records,
            expect.any(Object),
            900_000,
            expect.any(Function),
        );
    });
});
