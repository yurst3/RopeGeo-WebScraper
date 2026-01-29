import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { processPageHandler } from '../../../src/ropewiki/lambda-handlers/processPageHandler';
import type { SqsEvent } from '@aws-lambda-powertools/parser/types';

// Mock dependencies
jest.mock('../../../src/helpers/getDatabaseConnection');
jest.mock('../../../src/ropewiki/sqs/handleProcessPageSQSMessages');

const mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default as jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
const mockHandleProcessPageSQSMessages = require('../../../src/ropewiki/sqs/handleProcessPageSQSMessages').default as jest.MockedFunction<typeof import('../../../src/ropewiki/sqs/handleProcessPageSQSMessages').default>;

describe('processPageHandler', () => {
    let mockPool: any;
    let mockClient: any;
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

    const createSqsEvent = (bodies: string[]): SqsEvent => {
        return {
            Records: bodies.map((body, index) => ({
                messageId: `msg-${index}`,
                receiptHandle: `receipt-${index}`,
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
            })),
        };
    };

    const createPageData = (pageid: string, name: string) => {
        return JSON.stringify({
            id: 'page-uuid-1',
            pageid,
            name,
            region: 'region-uuid',
            url: `https://ropewiki.com/${name}`,
            latestRevisionDate: '2024-01-01T00:00:00.000Z',
            isValid: true,
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock database connection
        mockClient = {
            query: jest.fn<() => Promise<any>>().mockResolvedValue({}),
            release: jest.fn<() => void>(),
        };
        mockPool = {
            connect: jest.fn<() => Promise<any>>().mockResolvedValue(mockClient),
            end: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        } as any;
        mockGetDatabaseConnection.mockResolvedValue(mockPool);

        // Default: handleProcessPageSQSMessages succeeds
        mockHandleProcessPageSQSMessages.mockResolvedValue({
            successes: 0,
            errors: 0,
            remaining: 0,
        });
    });

    it('successfully processes a single page', async () => {
        const event = createSqsEvent([createPageData('123', 'Test Page')]);
        mockHandleProcessPageSQSMessages.mockResolvedValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });

        const result = await processPageHandler(event, {});

        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockHandleProcessPageSQSMessages).toHaveBeenCalledTimes(1);
        expect(mockHandleProcessPageSQSMessages).toHaveBeenCalledWith(event.Records, mockClient);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(mockPool.end).toHaveBeenCalledTimes(1);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Processed 1 pages');
        expect(body.results).toEqual({
            successes: 1,
            errors: 0,
            remaining: 0,
        });
    });

    it('successfully processes multiple pages', async () => {
        const event = createSqsEvent([
            createPageData('123', 'Page 1'),
            createPageData('456', 'Page 2'),
            createPageData('789', 'Page 3'),
        ]);
        mockHandleProcessPageSQSMessages.mockResolvedValue({
            successes: 3,
            errors: 0,
            remaining: 0,
        });

        const result = await processPageHandler(event, {});

        expect(mockHandleProcessPageSQSMessages).toHaveBeenCalledWith(event.Records, mockClient);
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Processed 3 pages');
        expect(body.results).toEqual({
            successes: 3,
            errors: 0,
            remaining: 0,
        });
    });

    it('reports successes and errors from handleProcessPageSQSMessages', async () => {
        const event = createSqsEvent([
            createPageData('123', 'Page 1'),
            createPageData('456', 'Page 2'),
        ]);
        // Simulate that one page succeeded and one had an error (logged internally)
        mockHandleProcessPageSQSMessages.mockResolvedValue({
            successes: 1,
            errors: 1,
            remaining: 0,
        });

        const result = await processPageHandler(event, {});

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.results).toEqual({
            successes: 1,
            errors: 1,
            remaining: 0,
        });
    });

    it('throws error for invalid SQS event with missing Records', async () => {
        const event = {} as SqsEvent;

        const result = await processPageHandler(event, {});

        expect(mockHandleProcessPageSQSMessages).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process pages');
        expect(body.error).toBe('Invalid SQS event: missing Records array or empty Records');
        expect(body.results).toBeUndefined();
    });

    it('throws error for invalid SQS event with empty Records', async () => {
        const event: SqsEvent = {
            Records: [],
        };

        const result = await processPageHandler(event, {});

        expect(mockHandleProcessPageSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.error).toBe('Invalid SQS event: missing Records array or empty Records');
        expect(body.results).toBeUndefined();
    });

    it('handles errors from handleProcessPageSQSMessages', async () => {
        const event = createSqsEvent([
            createPageData('123', 'Page 1'),
            createPageData('456', 'Page 2'),
        ]);
        mockHandleProcessPageSQSMessages.mockRejectedValue(new Error('HTTP error: Failed to fetch'));

        const result = await processPageHandler(event, {});

        expect(mockHandleProcessPageSQSMessages).toHaveBeenCalledWith(event.Records, mockClient);
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Failed to process pages');
        expect(body.error).toBe('HTTP error: Failed to fetch');
        expect(body.results).toBeUndefined();
    });

    it('handles database connection errors', async () => {
        const event = createSqsEvent([createPageData('123', 'Test Page')]);
        mockGetDatabaseConnection.mockRejectedValue(new Error('Connection failed'));

        const result = await processPageHandler(event, {});

        expect(mockHandleProcessPageSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.error).toBe('Connection failed');
        expect(body.results).toBeUndefined();
    });

    it('handles errors when connecting to database fails', async () => {
        const event = createSqsEvent([createPageData('123', 'Test Page')]);
        mockPool.connect.mockRejectedValue(new Error('Connection failed'));

        const result = await processPageHandler(event, {});

        expect(mockHandleProcessPageSQSMessages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.error).toBe('Connection failed');
        expect(body.results).toBeUndefined();
    });

    it('always releases client and ends pool in finally block', async () => {
        const event = createSqsEvent([createPageData('123', 'Test Page')]);
        mockHandleProcessPageSQSMessages.mockRejectedValue(new Error('Processing failed'));

        await processPageHandler(event, {});

        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('handles non-Error objects in catch block', async () => {
        const event = createSqsEvent([createPageData('123', 'Test Page')]);
        mockHandleProcessPageSQSMessages.mockRejectedValue('String error');

        const result = await processPageHandler(event, {});

        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.error).toBe('String error');
        expect(body.results).toBeUndefined();
    });
});
