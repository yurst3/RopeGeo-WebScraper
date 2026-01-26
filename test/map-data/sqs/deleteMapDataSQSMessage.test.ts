import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import deleteMapDataSQSMessage from '../../../src/map-data/sqs/deleteMapDataSQSMessage';

// Mock the helper function
jest.mock('../../../src/helpers/sqs/deleteSQSMessage', () => {
    return {
        __esModule: true,
        default: jest.fn(),
    };
});

const deleteSQSMessage = require('../../../src/helpers/sqs/deleteSQSMessage').default as jest.MockedFunction<typeof import('../../../src/helpers/sqs/deleteSQSMessage').default>;

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

    it('successfully deletes a message from the queue', async () => {
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
        delete process.env.MAP_DATA_PROCESSING_QUEUE_URL;
        const receiptHandle = 'test-receipt-handle';

        await expect(deleteMapDataSQSMessage(receiptHandle)).rejects.toThrow(
            'MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set',
        );

        expect(deleteSQSMessage).not.toHaveBeenCalled();
    });

    it('propagates errors from helper function', async () => {
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const sqsError = new Error('SQS deletion failed');
        deleteSQSMessage.mockRejectedValue(sqsError);

        await expect(deleteMapDataSQSMessage(receiptHandle)).rejects.toThrow('SQS deletion failed');

        expect(deleteSQSMessage).toHaveBeenCalledTimes(1);
    });
});
