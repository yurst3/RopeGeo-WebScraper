import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import setPageZipperSQSMessageVisibilityTimeout from '../../../src/page-zipper/sqs/setPageZipperSQSMessageVisibilityTimeout';

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    changeSQSMessageVisibilityTimeout: jest.fn(),
}));

const changeSQSMessageVisibilityTimeout = require('ropegeo-common/helpers')
    .changeSQSMessageVisibilityTimeout as jest.MockedFunction<
    typeof import('ropegeo-common/helpers').changeSQSMessageVisibilityTimeout
>;

describe('setPageZipperSQSMessageVisibilityTimeout', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        changeSQSMessageVisibilityTimeout.mockResolvedValue(undefined);
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('skips when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        await setPageZipperSQSMessageVisibilityTimeout('rh');
        expect(changeSQSMessageVisibilityTimeout).not.toHaveBeenCalled();
    });

    it('uses PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS by default', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.PAGE_ZIPPER_QUEUE_URL = 'https://sqs.example.com/q.fifo';
        process.env.PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS = '900';

        await setPageZipperSQSMessageVisibilityTimeout('rh');

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'https://sqs.example.com/q.fifo',
            'rh',
            900,
        );
    });

    it('allows an explicit visibility override', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.PAGE_ZIPPER_QUEUE_URL = 'https://sqs.example.com/q.fifo';

        await setPageZipperSQSMessageVisibilityTimeout('rh', 0);

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'https://sqs.example.com/q.fifo',
            'rh',
            0,
        );
    });

    it('throws when PAGE_ZIPPER_QUEUE_URL is missing', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.PAGE_ZIPPER_QUEUE_URL;
        await expect(setPageZipperSQSMessageVisibilityTimeout('rh', 0)).rejects.toThrow(
            'PAGE_ZIPPER_QUEUE_URL environment variable is not set',
        );
    });
});
