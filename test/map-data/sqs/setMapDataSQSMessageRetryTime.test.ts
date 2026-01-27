import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import setMapDataSQSMessageRetryTime from '../../../src/map-data/sqs/setMapDataSQSMessageRetryTime';

// Mock the helper function
jest.mock('../../../src/helpers/sqs/changeSQSMessageVisibilityTimeout', () => {
    return {
        __esModule: true,
        default: jest.fn(),
    };
});

const changeSQSMessageVisibilityTimeout = require('../../../src/helpers/sqs/changeSQSMessageVisibilityTimeout').default as jest.MockedFunction<typeof import('../../../src/helpers/sqs/changeSQSMessageVisibilityTimeout').default>;

describe('setMapDataSQSMessageRetryTime', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        changeSQSMessageVisibilityTimeout.mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('skips setting retry time when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await setMapDataSQSMessageRetryTime(receiptHandle, retryInSeconds);

        expect(consoleSpy).toHaveBeenCalledWith('Skipping SQS message visibility timeout change - no queue configured locally');
        expect(changeSQSMessageVisibilityTimeout).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('successfully sets visibility timeout for a message', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await setMapDataSQSMessageRetryTime(receiptHandle, retryInSeconds);

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledTimes(1);
        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
            receiptHandle,
            retryInSeconds,
        );
    });

    it('accepts minimum retry time of 0 seconds', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await setMapDataSQSMessageRetryTime(receiptHandle, 0);

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
            receiptHandle,
            0,
        );
    });

    it('accepts maximum retry time of 43200 seconds', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await setMapDataSQSMessageRetryTime(receiptHandle, 43200);

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
            receiptHandle,
            43200,
        );
    });

    it('propagates validation errors from helper function', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const validationError = new Error('retryInSeconds must be between 0 and 43200, got -1');
        changeSQSMessageVisibilityTimeout.mockRejectedValue(validationError);

        await expect(setMapDataSQSMessageRetryTime(receiptHandle, -1)).rejects.toThrow(
            'retryInSeconds must be between 0 and 43200, got -1',
        );

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledTimes(1);
    });

    it('throws error when MAP_DATA_PROCESSING_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.MAP_DATA_PROCESSING_QUEUE_URL;
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;

        await expect(setMapDataSQSMessageRetryTime(receiptHandle, retryInSeconds)).rejects.toThrow(
            'MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set',
        );

        expect(changeSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
    });

    it('propagates errors from helper function', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';
        const retryInSeconds = 300;
        const sqsError = new Error('SQS visibility timeout change failed');
        changeSQSMessageVisibilityTimeout.mockRejectedValue(sqsError);

        await expect(setMapDataSQSMessageRetryTime(receiptHandle, retryInSeconds)).rejects.toThrow(
            'SQS visibility timeout change failed',
        );

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledTimes(1);
    });
});
