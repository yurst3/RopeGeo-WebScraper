import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import deleteProcessPageSQSMessage from '../../../src/ropewiki/sqs/deleteProcessPageSQSMessage';

// Mock @aws-sdk/client-sqs
const mockSend = jest.fn<() => Promise<any>>();
const mockSQSClient = {
    send: mockSend,
};

jest.mock('@aws-sdk/client-sqs', () => {
    const MockSQSClient = jest.fn(() => mockSQSClient);
    const MockDeleteMessageCommand = jest.fn();
    return {
        SQSClient: MockSQSClient,
        DeleteMessageCommand: MockDeleteMessageCommand,
    };
});

const { SQSClient, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

describe('deleteProcessPageSQSMessage', () => {
    const originalEnv = process.env;
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;
    let MockSQSClient: any;
    let MockDeleteMessageCommand: any;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        MockSQSClient = SQSClient;
        MockDeleteMessageCommand = DeleteMessageCommand;
        mockSend.mockResolvedValue({});
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
    });

    it('successfully deletes a message from the queue', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await deleteProcessPageSQSMessage(receiptHandle);

        expect(MockSQSClient).toHaveBeenCalledWith({});
        expect(MockDeleteMessageCommand).toHaveBeenCalledWith({
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
            ReceiptHandle: receiptHandle,
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('skips deletion and logs when DEV_ENVIRONMENT is "local"', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const receiptHandle = 'test-receipt-handle';

        await deleteProcessPageSQSMessage(receiptHandle);

        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping SQS message deletion - no queue configured locally');
        expect(MockSQSClient).not.toHaveBeenCalled();
        expect(MockDeleteMessageCommand).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('throws error when ROPEWIKI_PAGE_PROCESSING_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL;
        const receiptHandle = 'test-receipt-handle';

        await expect(deleteProcessPageSQSMessage(receiptHandle)).rejects.toThrow(
            'ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set',
        );

        expect(MockSQSClient).not.toHaveBeenCalled();
        expect(MockDeleteMessageCommand).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('propagates errors from SQS client', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const sqsError = new Error('SQS deletion failed');
        mockSend.mockRejectedValue(sqsError);

        await expect(deleteProcessPageSQSMessage(receiptHandle)).rejects.toThrow('SQS deletion failed');

        expect(MockSQSClient).toHaveBeenCalled();
        expect(MockDeleteMessageCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not skip deletion when DEV_ENVIRONMENT is not "local"', async () => {
        process.env.DEV_ENVIRONMENT = 'dev';
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await deleteProcessPageSQSMessage(receiptHandle);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(MockSQSClient).toHaveBeenCalled();
        expect(MockDeleteMessageCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not skip deletion when DEV_ENVIRONMENT is undefined', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await deleteProcessPageSQSMessage(receiptHandle);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(MockSQSClient).toHaveBeenCalled();
        expect(MockDeleteMessageCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });
});
