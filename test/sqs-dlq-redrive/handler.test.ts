import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { handler } from '../../src/sqs-dlq-redrive/handler';

const mockSend = jest.fn<() => Promise<unknown>>();
const mockSQSClient = { send: mockSend };

jest.mock('ropegeo-common/helpers/sqs/getSQSClient', () => ({
    getSQSClient: jest.fn(() => mockSQSClient),
    resetSQSClientForTests: jest.fn(),
}));

describe('SqsDlqRedrive handler', () => {
    const arn1 = 'arn:aws:sqs:us-east-1:123:image-processor-dlq';
    const arn2 = 'arn:aws:sqs:us-east-1:123:map-data-dlq';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SQS_DLQ_ARNS = `${arn1},${arn2}`;
    });

    it('throws when SQS_DLQ_ARNS is not set', async () => {
        delete process.env.SQS_DLQ_ARNS;

        await expect(handler()).rejects.toThrow(
            'SQS_DLQ_ARNS must be set',
        );
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('starts move task for each DLQ and returns counts', async () => {
        mockSend
            .mockResolvedValueOnce({ Results: [] })
            .mockResolvedValueOnce({ TaskHandle: 'handle-1' })
            .mockResolvedValueOnce({ Results: [] })
            .mockResolvedValueOnce({ TaskHandle: 'handle-2' });

        const result = await handler();

        expect(result).toEqual({ started: 2, skipped: 0, errors: 0 });
        expect(mockSend).toHaveBeenCalledTimes(4);
    });

    it('skips DLQ when move task already running', async () => {
        mockSend
            .mockResolvedValueOnce({
                Results: [{ Status: 'RUNNING', TaskHandle: 'existing' }],
            })
            .mockResolvedValueOnce({ Results: [] })
            .mockResolvedValueOnce({ TaskHandle: 'handle-2' });

        const result = await handler();

        expect(result).toEqual({ started: 1, skipped: 1, errors: 0 });
        expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('counts errors when StartMessageMoveTask fails', async () => {
        mockSend
            .mockResolvedValueOnce({ Results: [] })
            .mockRejectedValueOnce(new Error('AccessDenied'))
            .mockResolvedValueOnce({ Results: [] })
            .mockResolvedValueOnce({ TaskHandle: 'handle-2' });

        const result = await handler();

        expect(result).toEqual({ started: 1, skipped: 0, errors: 1 });
    });
});
