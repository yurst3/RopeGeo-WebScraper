import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import findPageZipperJobInDlq from '../../../src/page-zipper/sqs/findPageZipperJobInDlq';

const mockSend = jest.fn();

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    getSQSClient: () => ({ send: mockSend }),
}));

describe('findPageZipperJobInDlq', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        mockSend.mockReset();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns false when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        await expect(findPageZipperJobInDlq('job-1')).resolves.toBe(false);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('throws when PAGE_ZIPPER_DLQ_URL is missing', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.PAGE_ZIPPER_DLQ_URL;
        await expect(findPageZipperJobInDlq('job-1')).rejects.toThrow(
            'PAGE_ZIPPER_DLQ_URL environment variable is not set',
        );
    });

    it('returns true when a matching job id is peeked and restores visibility', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.PAGE_ZIPPER_DLQ_URL = 'https://sqs.example.com/dlq.fifo';
        mockSend
            .mockResolvedValueOnce({
                Messages: [
                    {
                        ReceiptHandle: 'rh-1',
                        Body: JSON.stringify({ id: 'job-1' }),
                    },
                ],
            })
            .mockResolvedValueOnce({});

        await expect(findPageZipperJobInDlq('job-1')).resolves.toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(2);
        const visibilityCmd = mockSend.mock.calls[1]![0] as { input: { VisibilityTimeout: number } };
        expect(visibilityCmd.input.VisibilityTimeout).toBe(0);
    });

    it('returns false when no matching job id is found', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.PAGE_ZIPPER_DLQ_URL = 'https://sqs.example.com/dlq.fifo';
        mockSend
            .mockResolvedValueOnce({
                Messages: [
                    {
                        ReceiptHandle: 'rh-1',
                        Body: JSON.stringify({ id: 'other-job' }),
                    },
                ],
            })
            .mockResolvedValueOnce({});

        await expect(findPageZipperJobInDlq('job-1')).resolves.toBe(false);
    });
});
