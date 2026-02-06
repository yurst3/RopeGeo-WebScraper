import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import changeSQSMessageVisibilityTimeout from '../../../src/helpers/sqs/changeSQSMessageVisibilityTimeout';
import { resetSQSClientForTests } from '../../../src/helpers/sqs/getSQSClient';

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

describe('changeSQSMessageVisibilityTimeout', () => {
    const originalEnv = process.env;
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;
    let MockSQSClient: any;
    let MockChangeMessageVisibilityCommand: any;

    beforeEach(() => {
        resetSQSClientForTests();
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
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, retryInSeconds);

        expect(MockSQSClient).toHaveBeenCalledWith({});
        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalledWith({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle,
            VisibilityTimeout: retryInSeconds,
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('accepts minimum retry time of 0 seconds', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, 0);

        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                VisibilityTimeout: 0,
            }),
        );
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('accepts maximum retry time of 43200 seconds', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, 43200);

        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                VisibilityTimeout: 43200,
            }),
        );
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws error when retryInSeconds is less than 0', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await expect(changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, -1)).rejects.toThrow(
            'retryInSeconds must be between 0 and 43200, got -1',
        );

        expect(MockSQSClient).not.toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('throws error when retryInSeconds is greater than 43200', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await expect(changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, 43201)).rejects.toThrow(
            'retryInSeconds must be between 0 and 43200, got 43201',
        );

        expect(MockSQSClient).not.toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('skips setting visibility timeout and logs when DEV_ENVIRONMENT is "local"', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, retryInSeconds);

        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping SQS message visibility timeout change - no queue configured locally');
        expect(MockSQSClient).not.toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('propagates errors from SQS client', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;
        const sqsError = new Error('SQS visibility timeout change failed');
        mockSend.mockRejectedValue(sqsError);

        await expect(changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, retryInSeconds)).rejects.toThrow(
            'SQS visibility timeout change failed',
        );

        expect(MockSQSClient).toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('retries on EBUSY and succeeds on second attempt', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;
        const ebusy = new Error('getaddrinfo EBUSY') as NodeJS.ErrnoException;
        ebusy.code = 'EBUSY';
        mockSend.mockRejectedValueOnce(ebusy).mockResolvedValueOnce({});

        await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, retryInSeconds, 5);

        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('does not skip when DEV_ENVIRONMENT is not "local"', async () => {
        process.env.DEV_ENVIRONMENT = 'dev';
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, retryInSeconds);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(MockSQSClient).toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not skip when DEV_ENVIRONMENT is undefined', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, retryInSeconds);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(MockSQSClient).toHaveBeenCalled();
        expect(MockChangeMessageVisibilityCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });
});
