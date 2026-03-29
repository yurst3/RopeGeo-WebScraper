import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import setImageProcessorSQSMessageVisibilityTimeout from '../../../src/image-data/sqs/setImageProcessorSQSMessageVisibilityTimeout';

jest.mock('ropegeo-common/helpers/sqs/changeSQSMessageVisibilityTimeout', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}));

const mockChangeVisibility = require('ropegeo-common/helpers/sqs/changeSQSMessageVisibilityTimeout').default as jest.Mock;

describe('setImageProcessorSQSMessageVisibilityTimeout', () => {
    const originalEnv = process.env;
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
    });

    it('skips and logs when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        await setImageProcessorSQSMessageVisibilityTimeout('receipt-handle');
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Skipping SQS message visibility timeout change - no queue configured locally',
        );
        expect(mockChangeVisibility).not.toHaveBeenCalled();
    });

    it('throws when IMAGE_PROCESSOR_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.IMAGE_PROCESSOR_QUEUE_URL;
        process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS = '900';
        await expect(setImageProcessorSQSMessageVisibilityTimeout('rh')).rejects.toThrow(
            'IMAGE_PROCESSOR_QUEUE_URL environment variable is not set',
        );
    });

    it('throws when IMAGE_PROCESSOR_TIMEOUT_SECONDS is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.IMAGE_PROCESSOR_QUEUE_URL = 'https://sqs.example.com/queue';
        delete process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS;
        await expect(setImageProcessorSQSMessageVisibilityTimeout('rh')).rejects.toThrow(
            'IMAGE_PROCESSOR_TIMEOUT_SECONDS environment variable is not set',
        );
    });

    it('throws when IMAGE_PROCESSOR_TIMEOUT_SECONDS is out of range', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.IMAGE_PROCESSOR_QUEUE_URL = 'https://sqs.example.com/queue';
        process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS = '99999';
        await expect(setImageProcessorSQSMessageVisibilityTimeout('rh')).rejects.toThrow(
            'IMAGE_PROCESSOR_TIMEOUT_SECONDS must be between 0 and 43200',
        );
    });

    it('calls changeSQSMessageVisibilityTimeout with queue URL, receipt handle, and timeout when not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.IMAGE_PROCESSOR_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/queue';
        process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS = '900';
        await setImageProcessorSQSMessageVisibilityTimeout('my-receipt');
        expect(mockChangeVisibility).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123/queue',
            'my-receipt',
            900,
        );
    });
});
