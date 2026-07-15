import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import handleRelevanceSQSMessages from '../../../src/map-data/sqs/handleRelevanceSQSMessages';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from 'ropegeo-common/models';

jest.mock('../../../src/map-data/processors/processRelevanceJob', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/sqs/deleteRelevanceSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/sqs/setRelevanceSQSMessageVisibilityTimeout', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/util/getRelevanceErrorRetryVisibilityTimeoutSeconds', () => ({
    getRelevanceErrorRetryVisibilityTimeoutSeconds: jest.fn(() => 21600),
}));
jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    ProgressLogger: jest.fn(),
    timeoutAfter: (_ms: number, fn: () => unknown) => fn(),
}));

const processRelevanceJob = require('../../../src/map-data/processors/processRelevanceJob')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/processors/processRelevanceJob').default
>;
const deleteRelevanceSQSMessage = require('../../../src/map-data/sqs/deleteRelevanceSQSMessage')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/sqs/deleteRelevanceSQSMessage').default
>;
const setRelevanceSQSMessageVisibilityTimeout =
    require('../../../src/map-data/sqs/setRelevanceSQSMessageVisibilityTimeout')
        .default as jest.MockedFunction<
        typeof import('../../../src/map-data/sqs/setRelevanceSQSMessageVisibilityTimeout').default
    >;
const ProgressLogger = require('ropegeo-common/helpers').ProgressLogger;

const LAMBDA_TIMEOUT_MS = 900_000;

describe('handleRelevanceSQSMessages', () => {
    let mockClient: any;
    let mockLogger: any;

    const createRecord = (body: object, receiptHandle: string): SqsRecord => ({
        messageId: 'msg-1',
        receiptHandle,
        body: JSON.stringify(body),
        attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1523232000000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1523232000001',
        },
        messageAttributes: {},
        md5OfBody: 'md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:relevance',
        awsRegion: 'us-west-2',
    });

    const jobBody = {
        id: 'job-1',
        mapDataId: 'map-1',
        pageId: 'page-1',
        pageSource: PageDataSource.Ropewiki,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = { query: jest.fn() };
        mockLogger = {
            setChunk: jest.fn(),
            logProgress: jest.fn(),
            logError: jest.fn(),
            getResults: jest.fn().mockReturnValue({ successes: 1, errors: 0, remaining: 0 }),
        };
        ProgressLogger.mockImplementation(() => mockLogger);
        deleteRelevanceSQSMessage.mockResolvedValue(undefined);
        setRelevanceSQSMessageVisibilityTimeout.mockResolvedValue(undefined);
    });

    it('deletes the SQS message when the job completes', async () => {
        processRelevanceJob.mockResolvedValue({
            status: 'complete',
            processedCount: 2,
            skippedCount: 0,
        });

        await handleRelevanceSQSMessages(
            [createRecord(jobBody, 'receipt-1')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(deleteRelevanceSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(setRelevanceSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
    });

    it('sets visibility timeout to 0 when the job is partial', async () => {
        processRelevanceJob.mockResolvedValue({
            status: 'partial',
            processedCount: 1,
            skippedCount: 0,
            remainingCount: 4,
        });

        await handleRelevanceSQSMessages(
            [createRecord(jobBody, 'receipt-partial')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(setRelevanceSQSMessageVisibilityTimeout).toHaveBeenCalledWith('receipt-partial', 0);
        expect(deleteRelevanceSQSMessage).not.toHaveBeenCalled();
    });

    it('does not delete the message when processing throws', async () => {
        processRelevanceJob.mockRejectedValue(new Error('boom'));

        await handleRelevanceSQSMessages(
            [createRecord(jobBody, 'receipt-err')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(deleteRelevanceSQSMessage).not.toHaveBeenCalled();
        expect(setRelevanceSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
        expect(mockLogger.logError).toHaveBeenCalled();
    });

    it('deletes the SQS message when the job is missing', async () => {
        processRelevanceJob.mockResolvedValue({ status: 'missing_job' });

        await handleRelevanceSQSMessages(
            [createRecord(jobBody, 'receipt-missing')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(deleteRelevanceSQSMessage).toHaveBeenCalledWith('receipt-missing');
        expect(setRelevanceSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
    });

    it('defers the SQS message with a long visibility timeout when the job failed', async () => {
        processRelevanceJob.mockResolvedValue({
            status: 'failed',
            errors: [
                {
                    pageName: 'Test Page',
                    legendItemId: 'a',
                    legendItemName: 'A',
                    message: 'gateway timeout',
                },
            ],
            processedCount: 0,
            skippedCount: 0,
        });

        await handleRelevanceSQSMessages(
            [createRecord(jobBody, 'receipt-failed')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(setRelevanceSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'receipt-failed',
            21600,
        );
        expect(deleteRelevanceSQSMessage).not.toHaveBeenCalled();
    });

    it('deletes poison messages that fail to parse', async () => {
        await handleRelevanceSQSMessages(
            [createRecord({ id: 'incomplete' }, 'receipt-bad')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(deleteRelevanceSQSMessage).toHaveBeenCalledWith('receipt-bad');
        expect(processRelevanceJob).not.toHaveBeenCalled();
        expect(mockLogger.logError).toHaveBeenCalled();
    });
});
