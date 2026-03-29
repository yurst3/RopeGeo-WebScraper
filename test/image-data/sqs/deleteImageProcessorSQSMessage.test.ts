import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import deleteImageProcessorSQSMessage from '../../../src/image-data/sqs/deleteImageProcessorSQSMessage';

jest.mock('ropegeo-common/helpers/sqs/deleteSQSMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}));

const mockDeleteSQSMessage = require('ropegeo-common/helpers/sqs/deleteSQSMessage').default as jest.Mock;

describe('deleteImageProcessorSQSMessage', () => {
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

    it('skips deleting and logs when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        await deleteImageProcessorSQSMessage('receipt-handle');
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Skipping SQS message deletion - no queue configured locally',
        );
        expect(mockDeleteSQSMessage).not.toHaveBeenCalled();
    });

    it('throws when IMAGE_PROCESSOR_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.IMAGE_PROCESSOR_QUEUE_URL;
        await expect(deleteImageProcessorSQSMessage('rh')).rejects.toThrow(
            'IMAGE_PROCESSOR_QUEUE_URL environment variable is not set',
        );
        expect(mockDeleteSQSMessage).not.toHaveBeenCalled();
    });

    it('calls deleteSQSMessage with queue URL and receipt handle when not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.IMAGE_PROCESSOR_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/queue';
        await deleteImageProcessorSQSMessage('my-receipt-handle');
        expect(mockDeleteSQSMessage).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123/queue',
            'my-receipt-handle',
        );
    });
});
