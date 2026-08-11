import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const send = jest.fn() as jest.MockedFunction<(command: unknown) => Promise<unknown>>;

jest.mock('ropegeo-common/helpers', () => ({
    getSQSClient: () => ({ send }),
}));

const purgePageZipperQueues = require('../../../src/page-zipper/sqs/purgePageZipperQueues')
    .default as typeof import('../../../src/page-zipper/sqs/purgePageZipperQueues').default;

describe('purgePageZipperQueues', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.DEV_ENVIRONMENT;
        process.env.PAGE_ZIPPER_QUEUE_URL = 'https://sqs.example.com/q.fifo';
        process.env.PAGE_ZIPPER_DLQ_URL = 'https://sqs.example.com/dlq.fifo';
        send.mockResolvedValue({});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('purges the main queue and DLQ', async () => {
        await purgePageZipperQueues();

        expect(send).toHaveBeenCalledTimes(2);
        const queueUrls = send.mock.calls.map((call) => {
            const command = call[0] as { input: { QueueUrl: string } };
            return command.input.QueueUrl;
        });
        expect(queueUrls).toEqual([
            'https://sqs.example.com/q.fifo',
            'https://sqs.example.com/dlq.fifo',
        ]);
    });

    it('skips when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        await purgePageZipperQueues();
        expect(send).not.toHaveBeenCalled();
    });

    it('throws when queue URL env vars are missing', async () => {
        delete process.env.PAGE_ZIPPER_QUEUE_URL;
        await expect(purgePageZipperQueues()).rejects.toThrow(
            'PAGE_ZIPPER_QUEUE_URL environment variable is not set',
        );
    });
});
