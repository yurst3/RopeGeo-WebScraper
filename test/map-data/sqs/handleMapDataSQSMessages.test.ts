import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import handleMapDataSQSMessages from '../../../src/map-data/sqs/handleMapDataSQSMessages';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';

// Mock dependencies
jest.mock('../../../src/map-data/main');
jest.mock('../../../src/map-data/types/lambdaEvent');
jest.mock('ropegeo-common/helpers/progressLogger');
jest.mock('../../../src/map-data/sqs/deleteMapDataSQSMessage');

const mockMain = require('../../../src/map-data/main').main as jest.MockedFunction<typeof import('../../../src/map-data/main').main>;
const MapDataEvent = require('../../../src/map-data/types/lambdaEvent').MapDataEvent;
const ProgressLogger = require('ropegeo-common/helpers/progressLogger').default;
const mockDeleteMapDataSQSMessage = require('../../../src/map-data/sqs/deleteMapDataSQSMessage').default as jest.MockedFunction<typeof import('../../../src/map-data/sqs/deleteMapDataSQSMessage').default>;

const LAMBDA_TIMEOUT_MS = 900_000;

describe('handleMapDataSQSMessages', () => {
    let mockClient: any;
    let mockLogger: any;
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

    const createSqsRecord = (body: string, receiptHandle: string): SqsRecord => {
        return {
            messageId: 'test-message-id',
            receiptHandle,
            body,
            attributes: {
                ApproximateReceiveCount: '1',
                SentTimestamp: '1523232000000',
                SenderId: 'AIDAIENQZJOLO23YVJ4VO',
                ApproximateFirstReceiveTimestamp: '1523232000001',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
            awsRegion: 'us-west-2',
        };
    };

    const createMapDataEventBody = (
        routeId: string,
        pageId: string,
        source: string = 'ropewiki',
        downloadSource: boolean = true,
    ) => {
        return JSON.stringify({
            source,
            routeId,
            pageId,
            mapDataId: undefined,
            downloadSource,
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock database client
        mockClient = {
            query: jest.fn<() => Promise<any>>().mockResolvedValue({}),
        };

        // Mock ProgressLogger
        mockLogger = {
            setChunk: jest.fn(),
            logProgress: jest.fn(),
            logError: jest.fn(),
            getResults: jest.fn().mockReturnValue({
                successes: 0,
                errors: 0,
                remaining: 0,
            }),
        };
        ProgressLogger.mockImplementation(() => mockLogger);

        // Mock MapDataEvent.fromSQSEventRecord
        MapDataEvent.fromSQSEventRecord = jest.fn().mockImplementation((record: any) => {
            const eventData = JSON.parse(record.body);
            return {
                source: eventData.source,
                routeId: eventData.routeId,
                pageId: eventData.pageId,
                mapDataId: eventData.mapDataId,
                downloadSource: eventData.downloadSource,
            };
        });

        // Default: main succeeds
        mockMain.mockResolvedValue(undefined);
        mockDeleteMapDataSQSMessage.mockResolvedValue(undefined);
    });

    it('successfully processes a single record', async () => {
        const record = createSqsRecord(createMapDataEventBody('route-1', 'page-1'), 'receipt-1');
        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });

        const result = await handleMapDataSQSMessages([record], mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(MapDataEvent.fromSQSEventRecord).toHaveBeenCalledTimes(1);
        expect(mockMain).toHaveBeenCalledTimes(1);
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledTimes(1);
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(result).toEqual({
            successes: 1,
            errors: 0,
            remaining: 0,
        });
    });

    it('calls main with abortSignal as fifth argument', async () => {
        const record = createSqsRecord(createMapDataEventBody('route-1', 'page-1'), 'receipt-1');
        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });

        await handleMapDataSQSMessages([record], mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockMain).toHaveBeenCalledTimes(1);
        const mainCallArgs = mockMain.mock.calls[0]!;
        expect(mainCallArgs).toHaveLength(5);
        expect(mainCallArgs[4]).toBeInstanceOf(AbortSignal);
    });

    it('successfully processes multiple records', async () => {
        const records = [
            createSqsRecord(createMapDataEventBody('route-1', 'page-1'), 'receipt-1'),
            createSqsRecord(createMapDataEventBody('route-2', 'page-2'), 'receipt-2'),
            createSqsRecord(createMapDataEventBody('route-3', 'page-3'), 'receipt-3'),
        ];
        mockLogger.getResults.mockReturnValue({
            successes: 3,
            errors: 0,
            remaining: 0,
        });

        const result = await handleMapDataSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockMain).toHaveBeenCalledTimes(3);
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledTimes(3);
        expect(mockDeleteMapDataSQSMessage).toHaveBeenNthCalledWith(1, 'receipt-1');
        expect(mockDeleteMapDataSQSMessage).toHaveBeenNthCalledWith(2, 'receipt-2');
        expect(mockDeleteMapDataSQSMessage).toHaveBeenNthCalledWith(3, 'receipt-3');
        expect(result).toEqual({
            successes: 3,
            errors: 0,
            remaining: 0,
        });
    });

    it('handles parsing errors and deletes the message', async () => {
        const records = [
            createSqsRecord('invalid json', 'receipt-1'),
            createSqsRecord(createMapDataEventBody('route-2', 'page-2'), 'receipt-2'),
        ];
        MapDataEvent.fromSQSEventRecord
            .mockImplementationOnce(() => {
                throw new Error('Invalid event data');
            })
            .mockImplementationOnce((record: any) => {
                const eventData = JSON.parse(record.body);
                return {
                    source: eventData.source,
                    routeId: eventData.routeId,
                    pageId: eventData.pageId,
                    mapDataId: eventData.mapDataId,
                };
            });

        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 1,
            remaining: 0,
        });

        const result = await handleMapDataSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockLogger.logError).toHaveBeenCalledWith('Error parsing MapDataEvent from SQSEventRecord: Invalid event data');
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(mockMain).toHaveBeenCalledTimes(1); // Only the valid event
        expect(result).toEqual({
            successes: 1,
            errors: 1,
            remaining: 0,
        });
    });

    it('handles processing errors per message and continues to next', async () => {
        const records = [
            createSqsRecord(createMapDataEventBody('route-1', 'page-1'), 'receipt-1'),
            createSqsRecord(createMapDataEventBody('route-2', 'page-2'), 'receipt-2'),
            createSqsRecord(createMapDataEventBody('route-3', 'page-3'), 'receipt-3'),
        ];
        // First succeeds, second fails, third succeeds
        mockMain
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('Processing failed'))
            .mockResolvedValueOnce(undefined);

        mockLogger.getResults.mockReturnValue({
            successes: 2,
            errors: 1,
            remaining: 0,
        });

        const result = await handleMapDataSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockMain).toHaveBeenCalledTimes(3);
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledTimes(2); // First and third deleted
        expect(mockDeleteMapDataSQSMessage).toHaveBeenNthCalledWith(1, 'receipt-1');
        expect(mockDeleteMapDataSQSMessage).toHaveBeenNthCalledWith(2, 'receipt-3');
        expect(mockLogger.logError).toHaveBeenCalledWith(
            'Error processing map data for route route-2 / page page-2: Processing failed'
        );
        expect(result).toEqual({
            successes: 2,
            errors: 1,
            remaining: 0,
        });
    });

    it('handles error on first record and continues processing', async () => {
        const records = [
            createSqsRecord(createMapDataEventBody('route-1', 'page-1'), 'receipt-1'),
            createSqsRecord(createMapDataEventBody('route-2', 'page-2'), 'receipt-2'),
        ];
        mockMain
            .mockRejectedValueOnce(new Error('First failed'))
            .mockResolvedValueOnce(undefined);

        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 1,
            remaining: 0,
        });

        const result = await handleMapDataSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockMain).toHaveBeenCalledTimes(2);
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledTimes(1); // Only second deleted
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledWith('receipt-2');
        expect(result).toEqual({
            successes: 1,
            errors: 1,
            remaining: 0,
        });
    });

    it('handles empty records array', async () => {
        mockLogger.getResults.mockReturnValue({
            successes: 0,
            errors: 0,
            remaining: 0,
        });

        const result = await handleMapDataSQSMessages([], mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockMain).not.toHaveBeenCalled();
        expect(mockDeleteMapDataSQSMessage).not.toHaveBeenCalled();
        expect(result).toEqual({
            successes: 0,
            errors: 0,
            remaining: 0,
        });
    });

    it('reports successes and errors from progress logger', async () => {
        const records = [
            createSqsRecord(createMapDataEventBody('route-1', 'page-1'), 'receipt-1'),
            createSqsRecord(createMapDataEventBody('route-2', 'page-2'), 'receipt-2'),
        ];
        // Simulate that one succeeded and one had an error (logged internally)
        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 1,
            remaining: 0,
        });

        const result = await handleMapDataSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(result).toEqual({
            successes: 1,
            errors: 1,
            remaining: 0,
        });
    });

    it('processes single record even when remaining time is less than processMessageTimeoutMs', async () => {
        const record = createSqsRecord(createMapDataEventBody('route-1', 'page-1'), 'receipt-1');
        const lowRemainingMs = 100;
        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });

        const result = await handleMapDataSQSMessages(
            [record],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => lowRemainingMs,
        );

        expect(mockMain).toHaveBeenCalledTimes(1);
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(result).toEqual({ successes: 1, errors: 0, remaining: 0 });
    });

    it('stops starting new work when multiple records and remaining time below processMessageTimeoutMs', async () => {
        const records = [
            createSqsRecord(createMapDataEventBody('route-1', 'page-1'), 'receipt-1'),
            createSqsRecord(createMapDataEventBody('route-2', 'page-2'), 'receipt-2'),
        ];
        const processMessageTimeoutMs = Math.floor(LAMBDA_TIMEOUT_MS / 2);
        let callCount = 0;
        const getRemainingTimeInMillis = () => {
            callCount++;
            return callCount === 1 ? processMessageTimeoutMs + 1000 : processMessageTimeoutMs - 100;
        };
        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 0,
            remaining: 1,
        });

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await handleMapDataSQSMessages(
            records,
            mockClient,
            LAMBDA_TIMEOUT_MS,
            getRemainingTimeInMillis,
        );

        expect(mockMain).toHaveBeenCalledTimes(1);
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledTimes(1);
        expect(mockDeleteMapDataSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Stopping before message 2/2'),
        );
        expect(result).toEqual({ successes: 1, errors: 0, remaining: 1 });
        consoleWarnSpy.mockRestore();
    });
});
