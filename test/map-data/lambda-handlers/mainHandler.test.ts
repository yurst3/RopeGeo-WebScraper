import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mainHandler } from '../../../src/map-data/lambda-handlers/mainHandler';
import { PageDataSource } from '../../../src/map-data/types/mapData';
import { MapDataEvent } from '../../../src/map-data/types/lambdaEvent';
import type { SqsEvent, SqsRecord } from '@aws-lambda-powertools/parser/types';

// Mock the main function
let mockMain: jest.MockedFunction<typeof import('../../../src/map-data/main').main>;
jest.mock('../../../src/map-data/main', () => ({
    main: jest.fn(),
}));

// Mock MapDataEvent
let mockFromSQSEventRecord: jest.MockedFunction<typeof MapDataEvent.fromSQSEventRecord>;
jest.mock('../../../src/map-data/types/lambdaEvent', () => {
    const actual = jest.requireActual('../../../src/map-data/types/lambdaEvent');
    const ActualMapDataEvent = (actual as { MapDataEvent: typeof MapDataEvent }).MapDataEvent;
    const MockedMapDataEvent = ActualMapDataEvent;
    (MockedMapDataEvent as any).fromSQSEventRecord = jest.fn();
    return {
        MapDataEvent: MockedMapDataEvent,
        default: (actual as { default: typeof MapDataEvent }).default,
    };
});

describe('mainHandler', () => {
    const mockContext = {} as any;
    const routeId = '11111111-1111-1111-1111-111111111111';
    const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
    const source = PageDataSource.Ropewiki;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mocks
        const mainModule = require('../../../src/map-data/main');
        mockMain = mainModule.main;
        
        const lambdaEventModule = require('../../../src/map-data/types/lambdaEvent');
        mockFromSQSEventRecord = lambdaEventModule.MapDataEvent.fromSQSEventRecord;

        // Default mock implementations
        mockMain.mockResolvedValue(undefined);
    });

    it('successfully processes valid SQS event', async () => {
        const mapDataEvent = new MapDataEvent(source, routeId, pageId);
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                } as SqsRecord,
            ],
        };

        mockFromSQSEventRecord.mockReturnValue(mapDataEvent);

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockFromSQSEventRecord).toHaveBeenCalledWith(sqsEvent.Records[0]);
        expect(mockMain).toHaveBeenCalledWith(
            expect.any(Function), // lambdaSaveMapData
            source,
            pageId,
            routeId,
        );
        expect(result).toEqual({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Map data processed successfully',
                routeId,
                pageId,
                source,
            }),
        });
    });

    it('returns error when SQS event is missing Records', async () => {
        const sqsEvent = {} as SqsEvent;

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockFromSQSEventRecord).not.toHaveBeenCalled();
        expect(mockMain).not.toHaveBeenCalled();
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

        expect(mockFromSQSEventRecord).not.toHaveBeenCalled();
        expect(mockMain).not.toHaveBeenCalled();
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

        expect(mockFromSQSEventRecord).not.toHaveBeenCalled();
        expect(mockMain).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('Invalid SQS event: missing Records array or empty Records');
    });

    it('returns error when MapDataEvent.fromSQSEventRecord throws', async () => {
        const error = new Error('SQS record missing body');
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: undefined,
                } as SqsRecord,
            ],
        };

        mockFromSQSEventRecord.mockImplementation(() => {
            throw error;
        });

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockFromSQSEventRecord).toHaveBeenCalledWith(sqsEvent.Records[0]);
        expect(mockMain).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('SQS record missing body');
    });

    it('returns error when source is not Ropewiki', async () => {
        const unsupportedSource = 'UnsupportedSource' as PageDataSource;
        const mapDataEvent = new MapDataEvent(unsupportedSource, routeId, pageId);
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source: unsupportedSource,
                        routeId,
                        pageId,
                    }),
                } as SqsRecord,
            ],
        };

        mockFromSQSEventRecord.mockReturnValue(mapDataEvent);

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockFromSQSEventRecord).toHaveBeenCalledWith(sqsEvent.Records[0]);
        expect(mockMain).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe(`Unsupported source: ${unsupportedSource}`);
    });

    it('returns error when main function throws', async () => {
        const error = new Error('Database connection failed');
        const mapDataEvent = new MapDataEvent(source, routeId, pageId);
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                } as SqsRecord,
            ],
        };

        mockFromSQSEventRecord.mockReturnValue(mapDataEvent);
        mockMain.mockRejectedValue(error);

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockFromSQSEventRecord).toHaveBeenCalledWith(sqsEvent.Records[0]);
        expect(mockMain).toHaveBeenCalledWith(
            expect.any(Function),
            source,
            pageId,
            routeId,
        );
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('Database connection failed');
    });

    it('handles non-Error exceptions from main function', async () => {
        const error = 'String error';
        const mapDataEvent = new MapDataEvent(source, routeId, pageId);
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                } as SqsRecord,
            ],
        };

        mockFromSQSEventRecord.mockReturnValue(mapDataEvent);
        mockMain.mockRejectedValue(error);

        const result = await mainHandler(sqsEvent, mockContext);

        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process map data');
        expect(body.error).toBe('String error');
    });

    it('processes only the first record when multiple records exist', async () => {
        const mapDataEvent = new MapDataEvent(source, routeId, pageId);
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                } as SqsRecord,
                {
                    body: JSON.stringify({
                        source,
                        routeId: '22222222-2222-2222-2222-222222222222',
                        pageId: '33333333-3333-3333-3333-333333333333',
                    }),
                } as SqsRecord,
            ],
        };

        mockFromSQSEventRecord.mockReturnValue(mapDataEvent);

        const result = await mainHandler(sqsEvent, mockContext);

        expect(mockFromSQSEventRecord).toHaveBeenCalledTimes(1);
        expect(mockFromSQSEventRecord).toHaveBeenCalledWith(sqsEvent.Records[0]);
        expect(mockMain).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(200);
    });

    it('calls main with lambdaSaveMapData hook function', async () => {
        const mapDataEvent = new MapDataEvent(source, routeId, pageId);
        const sqsEvent: SqsEvent = {
            Records: [
                {
                    body: JSON.stringify({
                        source,
                        routeId,
                        pageId,
                    }),
                } as SqsRecord,
            ],
        };

        mockFromSQSEventRecord.mockReturnValue(mapDataEvent);

        await mainHandler(sqsEvent, mockContext);

        expect(mockMain).toHaveBeenCalledWith(
            expect.any(Function),
            source,
            pageId,
            routeId,
        );
        
        // Verify the first argument is a function (lambdaSaveMapData)
        const hookFn = mockMain.mock.calls[0]![0];
        expect(typeof hookFn).toBe('function');
    });
});
