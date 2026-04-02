import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import deleteMapDataSQSMessage from '../../../src/map-data/sqs/deleteMapDataSQSMessage';

// Mock the helper function
jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    deleteSQSMessage: jest.fn(),
}));

const deleteSQSMessage = require('ropegeo-common/helpers')
    .deleteSQSMessage as jest.MockedFunction<typeof import('ropegeo-common/helpers').deleteSQSMessage>;

describe('deleteMapDataSQSMessage', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        deleteSQSMessage.mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('skips deletion when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const receiptHandle = 'test-receipt-handle';
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await deleteMapDataSQSMessage(receiptHandle);

        expect(consoleSpy).toHaveBeenCalledWith('Skipping SQS message deletion - no queue configured locally');
        expect(deleteSQSMessage).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('successfully deletes a message from the queue', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await deleteMapDataSQSMessage(receiptHandle);

        expect(deleteSQSMessage).toHaveBeenCalledTimes(1);
        expect(deleteSQSMessage).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
            receiptHandle,
        );
    });

    it('throws error when MAP_DATA_PROCESSING_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.MAP_DATA_PROCESSING_QUEUE_URL;
        const receiptHandle = 'test-receipt-handle';

        await expect(deleteMapDataSQSMessage(receiptHandle)).rejects.toThrow(
            'MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set',
        );

        expect(deleteSQSMessage).not.toHaveBeenCalled();
    });

    it('propagates errors from helper function', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const sqsError = new Error('SQS deletion failed');
        deleteSQSMessage.mockRejectedValue(sqsError);

        await expect(deleteMapDataSQSMessage(receiptHandle)).rejects.toThrow('SQS deletion failed');

        expect(deleteSQSMessage).toHaveBeenCalledTimes(1);
    });
});
