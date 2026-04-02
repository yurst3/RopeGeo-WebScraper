import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import setMapDataSQSMessageVisibilityTimeout from '../../../src/map-data/sqs/setMapDataSQSMessageVisibilityTimeout';

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    changeSQSMessageVisibilityTimeout: jest.fn(),
}));

const changeSQSMessageVisibilityTimeout = require('ropegeo-common/helpers')
    .changeSQSMessageVisibilityTimeout as jest.MockedFunction<
    typeof import('ropegeo-common/helpers').changeSQSMessageVisibilityTimeout
>;

describe('setMapDataSQSMessageVisibilityTimeout', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        changeSQSMessageVisibilityTimeout.mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('skips setting visibility timeout when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const receiptHandle = 'test-receipt-handle';
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await setMapDataSQSMessageVisibilityTimeout(receiptHandle);

        expect(consoleSpy).toHaveBeenCalledWith(
            'Skipping SQS message visibility timeout change - no queue configured locally',
        );
        expect(changeSQSMessageVisibilityTimeout).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('successfully sets visibility timeout using MAP_DATA_PROCESSOR_TIMEOUT_SECONDS', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS = '900';
        const receiptHandle = 'test-receipt-handle';

        await setMapDataSQSMessageVisibilityTimeout(receiptHandle);

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledTimes(1);
        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
            receiptHandle,
            900,
        );
    });

    it('throws when MAP_DATA_PROCESSOR_TIMEOUT_SECONDS is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const receiptHandle = 'test-receipt-handle';

        await expect(setMapDataSQSMessageVisibilityTimeout(receiptHandle)).rejects.toThrow(
            'MAP_DATA_PROCESSOR_TIMEOUT_SECONDS environment variable is not set',
        );

        expect(changeSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
    });

    it('uses MAP_DATA_PROCESSOR_TIMEOUT_SECONDS when set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS = '300';
        const receiptHandle = 'test-receipt-handle';

        await setMapDataSQSMessageVisibilityTimeout(receiptHandle);

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
            receiptHandle,
            300,
        );
    });

    it('throws when MAP_DATA_PROCESSOR_TIMEOUT_SECONDS is invalid', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS = 'not-a-number';
        const receiptHandle = 'test-receipt-handle';

        await expect(setMapDataSQSMessageVisibilityTimeout(receiptHandle)).rejects.toThrow(
            'MAP_DATA_PROCESSOR_TIMEOUT_SECONDS must be between 0 and 43200, got: not-a-number',
        );

        expect(changeSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
    });

    it('throws error when MAP_DATA_PROCESSING_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.MAP_DATA_PROCESSING_QUEUE_URL;
        process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS = '900';
        const receiptHandle = 'test-receipt-handle';

        await expect(setMapDataSQSMessageVisibilityTimeout(receiptHandle)).rejects.toThrow(
            'MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set',
        );

        expect(changeSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
    });

    it('propagates errors from helper function', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        process.env.MAP_DATA_PROCESSOR_TIMEOUT_SECONDS = '900';
        const receiptHandle = 'test-receipt-handle';
        const sqsError = new Error('SQS visibility timeout change failed');
        changeSQSMessageVisibilityTimeout.mockRejectedValue(sqsError);

        await expect(setMapDataSQSMessageVisibilityTimeout(receiptHandle)).rejects.toThrow(
            'SQS visibility timeout change failed',
        );

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledTimes(1);
    });
});
