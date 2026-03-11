import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { startMoveTaskForDlq } from '../../../src/sqs-dlq-redrive/sqs/startMoveTaskForDlq';
import type { SQSClient } from '@aws-sdk/client-sqs';

const mockSend = jest.fn<() => Promise<unknown>>();
const mockSQSClient = { send: mockSend } as unknown as SQSClient;

describe('startMoveTaskForDlq', () => {
    const dlqArn = 'arn:aws:sqs:us-east-1:123:my-dlq';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('starts move task when no task is running and returns task handle', async () => {
        mockSend
            .mockResolvedValueOnce({ Results: [] })
            .mockResolvedValueOnce({ TaskHandle: 'handle-123' });

        const result = await startMoveTaskForDlq(mockSQSClient, dlqArn);

        expect(result).toEqual({ started: true, taskHandle: 'handle-123' });
        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('returns started: false when move task is already running', async () => {
        mockSend.mockResolvedValueOnce({
            Results: [{ Status: 'RUNNING', TaskHandle: 'existing' }],
        });

        const result = await startMoveTaskForDlq(mockSQSClient, dlqArn);

        expect(result).toEqual({ started: false });
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('returns error when ListMessageMoveTasks throws', async () => {
        mockSend.mockRejectedValueOnce(new Error('List failed'));

        const result = await startMoveTaskForDlq(mockSQSClient, dlqArn);

        expect(result).toEqual({
            started: false,
            error: 'List failed',
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('returns error when StartMessageMoveTask throws', async () => {
        mockSend
            .mockResolvedValueOnce({ Results: [] })
            .mockRejectedValueOnce(new Error('AccessDenied'));

        const result = await startMoveTaskForDlq(mockSQSClient, dlqArn);

        expect(result).toEqual({
            started: false,
            error: 'AccessDenied',
        });
        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('does not include taskHandle when TaskHandle is undefined', async () => {
        mockSend
            .mockResolvedValueOnce({ Results: [] })
            .mockResolvedValueOnce({});

        const result = await startMoveTaskForDlq(mockSQSClient, dlqArn);

        expect(result).toEqual({ started: true });
        expect(result).not.toHaveProperty('taskHandle');
    });
});
