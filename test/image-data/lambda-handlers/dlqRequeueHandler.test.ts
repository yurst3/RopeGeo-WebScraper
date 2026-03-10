import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { dlqRequeueHandler } from '../../../src/image-data/lambda-handlers/dlqRequeueHandler';

const mockSend = jest.fn<() => Promise<unknown>>();
const mockSQSClient = { send: mockSend };

jest.mock('../../../src/helpers/sqs/getSQSClient', () => ({
    getSQSClient: jest.fn(() => mockSQSClient),
    resetSQSClientForTests: jest.fn(),
}));

describe('ImageProcessor DLQ requeue handler', () => {
    const dlqUrl = 'https://sqs.us-east-1.amazonaws.com/123/image-processor-dlq';
    const mainQueueUrl = 'https://sqs.us-east-1.amazonaws.com/123/image-processor-queue';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.IMAGE_PROCESSOR_DLQ_URL = dlqUrl;
        process.env.IMAGE_PROCESSOR_QUEUE_URL = mainQueueUrl;
    });

    it('throws when IMAGE_PROCESSOR_DLQ_URL is not set', async () => {
        delete process.env.IMAGE_PROCESSOR_DLQ_URL;

        await expect(dlqRequeueHandler()).rejects.toThrow(
            'IMAGE_PROCESSOR_DLQ_URL and IMAGE_PROCESSOR_QUEUE_URL must be set',
        );
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('throws when IMAGE_PROCESSOR_QUEUE_URL is not set', async () => {
        delete process.env.IMAGE_PROCESSOR_QUEUE_URL;

        await expect(dlqRequeueHandler()).rejects.toThrow(
            'IMAGE_PROCESSOR_DLQ_URL and IMAGE_PROCESSOR_QUEUE_URL must be set',
        );
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('receives from DLQ, sends to main queue, deletes from DLQ, and returns counts', async () => {
        const body = '{"pageDataSource":"ropewiki","id":"11111111-1111-1111-1111-111111111111","source":"https://example.com/img.jpg"}';
        const receiptHandle = 'receipt-123';
        let callCount = 0;
        mockSend.mockImplementation((cmd: { name?: string }) => {
            callCount += 1;
            if (callCount === 1) {
                return Promise.resolve({ Messages: [{ Body: body, ReceiptHandle: receiptHandle }] });
            }
            return Promise.resolve({});
        });

        const result = await dlqRequeueHandler();

        expect(result).toEqual({ requeued: 1, errors: 0 });
        expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('returns requeued 0 and errors 0 when DLQ has no messages', async () => {
        mockSend.mockResolvedValue({ Messages: [] });

        const result = await dlqRequeueHandler();

        expect(result).toEqual({ requeued: 0, errors: 0 });
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('increments errors when message has no body', async () => {
        mockSend.mockResolvedValueOnce({
            Messages: [{ Body: undefined, ReceiptHandle: 'h1' }],
        });

        const result = await dlqRequeueHandler();

        expect(result).toEqual({ requeued: 0, errors: 1 });
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('increments errors when message has no receiptHandle', async () => {
        mockSend.mockResolvedValueOnce({
            Messages: [{ Body: '{}', ReceiptHandle: undefined }],
        });

        const result = await dlqRequeueHandler();

        expect(result).toEqual({ requeued: 0, errors: 1 });
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('increments errors when send or delete throws', async () => {
        const body = '{}';
        const receiptHandle = 'h1';
        mockSend
            .mockResolvedValueOnce({ Messages: [{ Body: body, ReceiptHandle: receiptHandle }] })
            .mockRejectedValueOnce(new Error('Send failed'));

        const result = await dlqRequeueHandler();

        expect(result).toEqual({ requeued: 0, errors: 1 });
        expect(mockSend).toHaveBeenCalledTimes(2);
    });
});
