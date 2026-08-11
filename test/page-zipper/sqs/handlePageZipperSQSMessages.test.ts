import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import handlePageZipperSQSMessages from '../../../src/page-zipper/sqs/handlePageZipperSQSMessages';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from 'ropegeo-common/models';

jest.mock('../../../src/page-zipper/main', () => ({
    main: jest.fn(),
}));
jest.mock('../../../src/page-zipper/sqs/deletePageZipperSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    ProgressLogger: jest.fn(),
    timeoutAfter: (_ms: number, fn: () => unknown) => fn(),
}));

const { main } = require('../../../src/page-zipper/main') as {
    main: jest.MockedFunction<typeof import('../../../src/page-zipper/main').main>;
};
const deletePageZipperSQSMessage = require('../../../src/page-zipper/sqs/deletePageZipperSQSMessage')
    .default as jest.MockedFunction<
    typeof import('../../../src/page-zipper/sqs/deletePageZipperSQSMessage').default
>;
const ProgressLogger = require('ropegeo-common/helpers').ProgressLogger;

const LAMBDA_TIMEOUT_MS = 900_000;

describe('handlePageZipperSQSMessages', () => {
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
        eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:page-zipper',
        awsRegion: 'us-west-2',
    });

    const jobBody = {
        id: 'job-1',
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
        deletePageZipperSQSMessage.mockResolvedValue(undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('deletes the SQS message when the job completes', async () => {
        main.mockResolvedValue({ status: 'complete' });

        await handlePageZipperSQSMessages(
            [createRecord(jobBody, 'receipt-1')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(main).toHaveBeenCalled();
        expect(deletePageZipperSQSMessage).toHaveBeenCalledWith('receipt-1');
        expect(mockLogger.logProgress).toHaveBeenCalled();
    });

    it('deletes the SQS message when the job is missing', async () => {
        main.mockResolvedValue({ status: 'missing_job' });

        await handlePageZipperSQSMessages(
            [createRecord(jobBody, 'receipt-missing')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(deletePageZipperSQSMessage).toHaveBeenCalledWith('receipt-missing');
    });

    it('leaves the message when the job is not ready', async () => {
        main.mockResolvedValue({ status: 'not_ready' });

        await handlePageZipperSQSMessages(
            [createRecord(jobBody, 'receipt-not-ready')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(deletePageZipperSQSMessage).not.toHaveBeenCalled();
    });

    it('deletes invalid parse payloads and continues', async () => {
        await handlePageZipperSQSMessages(
            [createRecord({ id: 'only-id' }, 'receipt-bad')],
            mockClient,
            LAMBDA_TIMEOUT_MS,
            () => LAMBDA_TIMEOUT_MS,
        );

        expect(main).not.toHaveBeenCalled();
        expect(deletePageZipperSQSMessage).toHaveBeenCalledWith('receipt-bad');
        expect(mockLogger.logError).toHaveBeenCalled();
    });
});
