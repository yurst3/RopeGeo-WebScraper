import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import setProcessPageSQSMessageRetryTime from '../../../src/ropewiki/sqs/setProcessPageSQSMessageRetryTime';

// Mock @aws-sdk/client-sqs
const mockSend = jest.fn<() => Promise<any>>();
const mockSQSClient = {
    send: mockSend,
};

jest.mock('@aws-sdk/client-sqs', () => {
    const MockSQSClient = jest.fn(() => mockSQSClient);
    const MockChangeMessageVisibilityCommand = jest.fn();
    return {
        SQSClient: MockSQSClient,
        ChangeMessageVisibilityCommand: MockChangeMessageVisibilityCommand,
    };
});

const { SQSClient, ChangeMessageVisibilityCommand } = require('@aws-sdk/client-sqs');

describe('setProcessPageSQSMessageRetryTime', () => {
    const originalEnv = process.env;
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;
    let MockSQSClient: any;
    let MockChangeMessageVisibilityCommand: any;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        MockSQSClient = SQSClient;
        MockChangeMessageVisibilityCommand = ChangeMessageVisibilityCommand;
        mockSend.mockResolvedValue({});
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
    });

    it('successfully sets visibility timeout for a message', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await setProcessPageSQSMessageRetryTime(receiptHandle, retryInSeconds);

        expect(MockSQSClient).toHaveBeenCalledWith({});
        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalledWith({
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
            ReceiptHandle: receiptHandle,
            VisibilityTimeout: retryInSeconds,
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('accepts minimum retry time of 0 seconds', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await setProcessPageSQSMessageRetryTime(receiptHandle, 0);

        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                VisibilityTimeout: 0,
            }),
        );
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('accepts maximum retry time of 43200 seconds', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await setProcessPageSQSMessageRetryTime(receiptHandle, 43200);

        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                VisibilityTimeout: 43200,
            }),
        );
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws error when retryInSeconds is less than 0', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await expect(setProcessPageSQSMessageRetryTime(receiptHandle, -1)).rejects.toThrow(
            'retryInSeconds must be between 0 and 43200, got -1',
        );

        expect(MockSQSClient).not.toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('throws error when retryInSeconds is greater than 43200', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await expect(setProcessPageSQSMessageRetryTime(receiptHandle, 43201)).rejects.toThrow(
            'retryInSeconds must be between 0 and 43200, got 43201',
        );

        expect(MockSQSClient).not.toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('skips setting visibility timeout and logs when DEV_ENVIRONMENT is "local"', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await setProcessPageSQSMessageRetryTime(receiptHandle, retryInSeconds);

        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping SQS message visibility timeout change - no queue configured locally');
        expect(MockSQSClient).not.toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('throws error when ROPEWIKI_PAGE_PROCESSING_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL;
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await expect(setProcessPageSQSMessageRetryTime(receiptHandle, retryInSeconds)).rejects.toThrow(
            'ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set',
        );

        expect(MockSQSClient).not.toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('propagates errors from SQS client', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;
        const sqsError = new Error('SQS visibility timeout change failed');
        mockSend.mockRejectedValue(sqsError);

        await expect(setProcessPageSQSMessageRetryTime(receiptHandle, retryInSeconds)).rejects.toThrow(
            'SQS visibility timeout change failed',
        );

        expect(MockSQSClient).toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not skip when DEV_ENVIRONMENT is not "local"', async () => {
        process.env.DEV_ENVIRONMENT = 'dev';
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await setProcessPageSQSMessageRetryTime(receiptHandle, retryInSeconds);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(MockSQSClient).toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not skip when DEV_ENVIRONMENT is undefined', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await setProcessPageSQSMessageRetryTime(receiptHandle, retryInSeconds);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(MockSQSClient).toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });
});
