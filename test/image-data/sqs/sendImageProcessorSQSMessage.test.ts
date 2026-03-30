import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import sendImageProcessorSQSMessage from '../../../src/image-data/sqs/sendImageProcessorSQSMessage';
import { ImageVersion, PageDataSource } from 'ropegeo-common';
import { ImageDataEvent } from '../../../src/image-data/types/lambdaEvent';

jest.mock('ropegeo-common/helpers/sqs/sendSQSMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}));

const mockSendSQSMessage = require('ropegeo-common/helpers/sqs/sendSQSMessage').default as jest.Mock;

describe('sendImageProcessorSQSMessage', () => {
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

    it('skips sending and logs when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const event = new ImageDataEvent(PageDataSource.Ropewiki, 'image-id', 'https://source.jpg');
        await sendImageProcessorSQSMessage(event);
        expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining('Skipping SQS message sending'),
        );
        expect(mockSendSQSMessage).not.toHaveBeenCalled();
    });

    it('throws when not local and IMAGE_PROCESSOR_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.IMAGE_PROCESSOR_QUEUE_URL;
        const event = new ImageDataEvent(PageDataSource.Ropewiki, 'id', 'https://s');
        await expect(sendImageProcessorSQSMessage(event)).rejects.toThrow(
            'IMAGE_PROCESSOR_QUEUE_URL environment variable is not set',
        );
        expect(mockSendSQSMessage).not.toHaveBeenCalled();
    });

    it('sends message with serialized event body when not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.IMAGE_PROCESSOR_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/queue';
        const event = new ImageDataEvent(PageDataSource.Ropewiki, 'img-123', 'https://example.com/file.jpg');
        await sendImageProcessorSQSMessage(event);
        expect(mockSendSQSMessage).toHaveBeenCalledTimes(1);
        const [body, queueUrl] = mockSendSQSMessage.mock.calls[0];
        expect(queueUrl).toBe('https://sqs.us-east-1.amazonaws.com/123/queue');
        const parsed = JSON.parse(body);
        expect(parsed.pageDataSource).toBe(PageDataSource.Ropewiki);
        expect(parsed.pageImageId).toBe('img-123');
        expect(parsed.sourceUrl).toBe('https://example.com/file.jpg');
        expect(parsed.downloadSource).toBe(true);
        expect(parsed.existingProcessedImageId).toBeUndefined();
    });

    it('includes downloadSource false in serialized body', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.IMAGE_PROCESSOR_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/queue';
        const event = new ImageDataEvent(
            PageDataSource.Ropewiki,
            'img-123',
            'https://example.com/file.jpg',
            false,
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        );
        await sendImageProcessorSQSMessage(event);
        const [body] = mockSendSQSMessage.mock.calls[0];
        expect(JSON.parse(body).downloadSource).toBe(false);
    });

    it('includes existingProcessedImageId when provided', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.IMAGE_PROCESSOR_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/queue';
        const event = new ImageDataEvent(
            PageDataSource.Ropewiki,
            'img-123',
            'https://example.com/file.jpg',
            false,
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        );
        await sendImageProcessorSQSMessage(event);
        const [body] = mockSendSQSMessage.mock.calls[0];
        expect(JSON.parse(body).existingProcessedImageId).toBe(
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        );
    });

    it('includes versions in serialized body when set on event', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.IMAGE_PROCESSOR_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/queue';
        const event = new ImageDataEvent(
            PageDataSource.Ropewiki,
            'img-123',
            'https://example.com/file.jpg',
            true,
            undefined,
            [ImageVersion.linkPreview],
        );
        await sendImageProcessorSQSMessage(event);
        const [body] = mockSendSQSMessage.mock.calls[0];
        expect(JSON.parse(body).versions).toEqual([ImageVersion.linkPreview]);
    });
});
