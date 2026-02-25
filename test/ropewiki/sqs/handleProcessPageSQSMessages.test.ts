import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import handleProcessPageSQSMessages from '../../../src/ropewiki/sqs/handleProcessPageSQSMessages';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';

// Mock dependencies
jest.mock('../../../src/ropewiki/processors/processPage');
jest.mock('../../../src/ropewiki/types/page');
jest.mock('../../../src/helpers/progressLogger');
jest.mock('../../../src/ropewiki/sqs/deleteProcessPageSQSMessage');

const mockProcessPage = require('../../../src/ropewiki/processors/processPage').processPage as jest.MockedFunction<typeof import('../../../src/ropewiki/processors/processPage').processPage>;
const RopewikiPage = require('../../../src/ropewiki/types/page').default;
const ProgressLogger = require('../../../src/helpers/progressLogger').default;
const mockDeleteProcessPageSQSMessage = require('../../../src/ropewiki/sqs/deleteProcessPageSQSMessage').default as jest.MockedFunction<typeof import('../../../src/ropewiki/sqs/deleteProcessPageSQSMessage').default>;

const LAMBDA_TIMEOUT_MS = 900_000;

describe('handleProcessPageSQSMessages', () => {
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

        // Mock RopewikiPage.fromSQSEventRecord
        RopewikiPage.fromSQSEventRecord = jest.fn().mockImplementation((record: any) => {
            const pageData = JSON.parse(record.body);
            return {
                pageid: pageData.pageid,
                name: pageData.name,
                id: pageData.id,
            };
        });

        // Default: processPage succeeds
        mockProcessPage.mockResolvedValue(undefined);
        mockDeleteProcessPageSQSMessage.mockResolvedValue(undefined);
    });

    it('successfully processes a single record', async () => {
        const record = createSqsRecord(createPageData('123', 'Test Page'), 'receipt-1');
        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });

        const result = await handleProcessPageSQSMessages([record], mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(RopewikiPage.fromSQSEventRecord).toHaveBeenCalledTimes(1);
        expect(mockProcessPage).toHaveBeenCalledTimes(1);
        expect(mockProcessPage).toHaveBeenCalledWith(mockClient, expect.any(Object), mockLogger, 'sp_page_0');
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledTimes(1);
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(result).toEqual({
            successes: 1,
            errors: 0,
            remaining: 0,
        });
    });

    it('successfully processes multiple records', async () => {
        const records = [
            createSqsRecord(createPageData('123', 'Page 1'), 'receipt-1'),
            createSqsRecord(createPageData('456', 'Page 2'), 'receipt-2'),
            createSqsRecord(createPageData('789', 'Page 3'), 'receipt-3'),
        ];
        mockLogger.getResults.mockReturnValue({
            successes: 3,
            errors: 0,
            remaining: 0,
        });

        const result = await handleProcessPageSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockProcessPage).toHaveBeenCalledTimes(3);
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledTimes(3);
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenNthCalledWith(1, 'receipt-1');
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenNthCalledWith(2, 'receipt-2');
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenNthCalledWith(3, 'receipt-3');
        expect(result).toEqual({
            successes: 3,
            errors: 0,
            remaining: 0,
        });
    });

    it('handles parsing errors and deletes the message', async () => {
        const records = [
            createSqsRecord('invalid json', 'receipt-1'),
            createSqsRecord(createPageData('456', 'Valid Page'), 'receipt-2'),
        ];
        RopewikiPage.fromSQSEventRecord
            .mockImplementationOnce(() => {
                throw new Error('Invalid page data');
            })
            .mockImplementationOnce((record: any) => {
                const pageData = JSON.parse(record.body);
                return {
                    pageid: pageData.pageid,
                    name: pageData.name,
                    id: pageData.id,
                };
            });

        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 1,
            remaining: 0,
        });

        const result = await handleProcessPageSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockLogger.logError).toHaveBeenCalledWith('Error parsing Ropewiki Page from SQSEventRecord: Invalid page data');
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(mockProcessPage).toHaveBeenCalledTimes(1); // Only the valid page
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(result).toEqual({
            successes: 1,
            errors: 1,
            remaining: 0,
        });
    });

    it('handles HTTP errors and continues to next message', async () => {
        const records = [
            createSqsRecord(createPageData('123', 'Page 1'), 'receipt-1'),
            createSqsRecord(createPageData('456', 'Page 2'), 'receipt-2'),
            createSqsRecord(createPageData('789', 'Page 3'), 'receipt-3'),
        ];
        mockProcessPage
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('HTTP error: Failed to fetch'))
            .mockResolvedValueOnce(undefined);

        mockLogger.getResults.mockReturnValue({
            successes: 2,
            errors: 1,
            remaining: 0,
        });

        const result = await handleProcessPageSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.query).not.toHaveBeenCalledWith('ROLLBACK');
        expect(mockProcessPage).toHaveBeenCalledTimes(3);
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledTimes(2); // receipt-1 and receipt-3
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledWith('receipt-3');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page: HTTP error: Failed to fetch');
        expect(result).toEqual({
            successes: 2,
            errors: 1,
            remaining: 0,
        });
    });

    it('handles HTTP error on first record and continues to second', async () => {
        const records = [
            createSqsRecord(createPageData('123', 'Page 1'), 'receipt-1'),
            createSqsRecord(createPageData('456', 'Page 2'), 'receipt-2'),
        ];
        mockProcessPage
            .mockRejectedValueOnce(new Error('HTTP error: Failed to fetch'))
            .mockResolvedValueOnce(undefined);

        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 1,
            remaining: 0,
        });

        const result = await handleProcessPageSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.query).not.toHaveBeenCalledWith('ROLLBACK');
        expect(mockProcessPage).toHaveBeenCalledTimes(2);
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledTimes(1);
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledWith('receipt-2');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page: HTTP error: Failed to fetch');
        expect(result).toEqual({
            successes: 1,
            errors: 1,
            remaining: 0,
        });
    });

    it('propagates error when BEGIN fails', async () => {
        const records = [createSqsRecord(createPageData('123', 'Test Page'), 'receipt-1')];
        mockClient.query.mockImplementation((query: string) => {
            if (query === 'BEGIN') {
                return Promise.reject(new Error('Transaction begin failed'));
            }
            return Promise.resolve({});
        });

        await expect(handleProcessPageSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS)).rejects.toThrow(
            'Transaction begin failed',
        );

        expect(mockProcessPage).not.toHaveBeenCalled();
    });

    it('propagates error when COMMIT fails', async () => {
        const records = [createSqsRecord(createPageData('123', 'Test Page'), 'receipt-1')];
        mockClient.query.mockImplementation((query: string) => {
            if (query === 'COMMIT') {
                return Promise.reject(new Error('Transaction commit failed'));
            }
            return Promise.resolve({});
        });

        await expect(handleProcessPageSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS)).rejects.toThrow(
            'Transaction commit failed',
        );

        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledWith('receipt-1');
    });

    it('logs processPage error and continues without rolling back', async () => {
        const records = [createSqsRecord(createPageData('123', 'Test Page'), 'receipt-1')];
        mockProcessPage.mockRejectedValueOnce(new Error('Processing failed'));

        mockLogger.getResults.mockReturnValue({
            successes: 0,
            errors: 1,
            remaining: 0,
        });

        const result = await handleProcessPageSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.query).not.toHaveBeenCalledWith('ROLLBACK');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page: Processing failed');
        expect(mockDeleteProcessPageSQSMessage).not.toHaveBeenCalled(); // message not deleted so it can retry
        expect(result).toEqual({
            successes: 0,
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

        const result = await handleProcessPageSQSMessages([], mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockProcessPage).not.toHaveBeenCalled();
        expect(mockDeleteProcessPageSQSMessage).not.toHaveBeenCalled();
        expect(result).toEqual({
            successes: 0,
            errors: 0,
            remaining: 0,
        });
    });

    it('reports successes and errors from progress logger', async () => {
        const records = [
            createSqsRecord(createPageData('123', 'Page 1'), 'receipt-1'),
            createSqsRecord(createPageData('456', 'Page 2'), 'receipt-2'),
        ];
        // Simulate that one page succeeded and one had an error (logged internally)
        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 1,
            remaining: 0,
        });

        const result = await handleProcessPageSQSMessages(records, mockClient, LAMBDA_TIMEOUT_MS, () => LAMBDA_TIMEOUT_MS);

        expect(result).toEqual({
            successes: 1,
            errors: 1,
            remaining: 0,
        });
    });

    it('processes single record even when remaining time is less than processPageTimeoutMs', async () => {
        const record = createSqsRecord(createPageData('123', 'Test Page'), 'receipt-1');
        const lowRemainingMs = 100;
        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 0,
            remaining: 0,
        });

        const result = await handleProcessPageSQSMessages(
            [record],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => lowRemainingMs,
        );

        expect(mockProcessPage).toHaveBeenCalledTimes(1);
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(result).toEqual({ successes: 1, errors: 0, remaining: 0 });
    });

    it('stops starting new work when multiple records and remaining time below processPageTimeoutMs', async () => {
        const records = [
            createSqsRecord(createPageData('123', 'Page 1'), 'receipt-1'),
            createSqsRecord(createPageData('456', 'Page 2'), 'receipt-2'),
        ];
        const processPageTimeoutMs = Math.floor(LAMBDA_TIMEOUT_MS / 2);
        let callCount = 0;
        const getRemainingTimeInMillis = () => {
            callCount++;
            return callCount === 1 ? processPageTimeoutMs + 1000 : processPageTimeoutMs - 100;
        };
        mockLogger.getResults.mockReturnValue({
            successes: 1,
            errors: 0,
            remaining: 1,
        });

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await handleProcessPageSQSMessages(
            records,
            mockClient,
            LAMBDA_TIMEOUT_MS,
            getRemainingTimeInMillis,
        );

        expect(mockProcessPage).toHaveBeenCalledTimes(1);
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledTimes(1);
        expect(mockDeleteProcessPageSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Stopping before message 2/2'),
        );
        expect(result).toEqual({ successes: 1, errors: 0, remaining: 1 });
        consoleWarnSpy.mockRestore();
    });
});
