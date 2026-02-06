import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import sendSQSMessage from '../../../src/helpers/sqs/sendSQSMessage';
import { resetSQSClientForTests } from '../../../src/helpers/sqs/getSQSClient';

// Mock @aws-sdk/client-sqs
const mockSend = jest.fn<() => Promise<unknown>>();
const mockSQSClient = {
    send: mockSend,
};

jest.mock('@aws-sdk/client-sqs', () => {
    const MockSQSClient = jest.fn(() => mockSQSClient);
    const MockSendMessageCommand = jest.fn();
    return {
        SQSClient: MockSQSClient,
        SendMessageCommand: MockSendMessageCommand,
    };
});

const { SQSClient: MockSQSClientConstructor, SendMessageCommand: MockSendMessageCommandConstructor } =
    require('@aws-sdk/client-sqs') as {
        SQSClient: jest.Mock;
        SendMessageCommand: jest.Mock;
    };

describe('sendSQSMessage', () => {
    const originalEnv = process.env;
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        resetSQSClientForTests();
        jest.clearAllMocks();
        process.env = { ...originalEnv };

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockSend.mockResolvedValue({});
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
    });

    it('successfully sends a message with body and queueUrl', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const body = '{"key":"value"}';

        await sendSQSMessage(body, queueUrl);

        expect(MockSQSClientConstructor).toHaveBeenCalledWith({});
        expect(MockSendMessageCommandConstructor).toHaveBeenCalledWith({
            QueueUrl: queueUrl,
            MessageBody: body,
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('successfully sends a message with optional attributes', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const body = '{"key":"value"}';
        const attributes = { Source: 'Ropewiki', Type: 'MapData' };

        await sendSQSMessage(body, queueUrl, attributes);

        expect(MockSendMessageCommandConstructor).toHaveBeenCalledWith({
            QueueUrl: queueUrl,
            MessageBody: body,
            MessageAttributes: {
                Source: { DataType: 'String', StringValue: 'Ropewiki' },
                Type: { DataType: 'String', StringValue: 'MapData' },
            },
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('sends message without MessageAttributes when attributes is undefined', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const body = 'message body';

        await sendSQSMessage(body, queueUrl);

        const call = MockSendMessageCommandConstructor.mock.calls[0]?.[0];
        expect(call).toHaveProperty('QueueUrl', queueUrl);
        expect(call).toHaveProperty('MessageBody', body);
        expect(call).not.toHaveProperty('MessageAttributes');
    });

    it('sends message without MessageAttributes when attributes is empty object', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const body = 'message body';

        await sendSQSMessage(body, queueUrl, {});

        const call = MockSendMessageCommandConstructor.mock.calls[0]?.[0];
        expect(call).toHaveProperty('QueueUrl', queueUrl);
        expect(call).toHaveProperty('MessageBody', body);
        expect(call).not.toHaveProperty('MessageAttributes');
    });

    it('skips sending and logs when DEV_ENVIRONMENT is "local"', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const body = '{"key":"value"}';

        await sendSQSMessage(body, queueUrl);

        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Skipping SQS message send - no queue configured locally',
        );
        expect(MockSQSClientConstructor).not.toHaveBeenCalled();
        expect(MockSendMessageCommandConstructor).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('does not skip when DEV_ENVIRONMENT is "dev"', async () => {
        process.env.DEV_ENVIRONMENT = 'dev';
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const body = 'message';

        await sendSQSMessage(body, queueUrl);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(MockSendMessageCommandConstructor).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not skip when DEV_ENVIRONMENT is undefined', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const body = 'message';

        await sendSQSMessage(body, queueUrl);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(MockSendMessageCommandConstructor).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from SQS client', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const body = 'message';
        const sqsError = new Error('SQS send failed');
        mockSend.mockRejectedValue(sqsError);

        await expect(sendSQSMessage(body, queueUrl)).rejects.toThrow('SQS send failed');

        expect(MockSQSClientConstructor).toHaveBeenCalled();
        expect(MockSendMessageCommandConstructor).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('retries on EBUSY and succeeds on second attempt', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
        const body = 'message';
        const ebusy = new Error('getaddrinfo EBUSY sqs.us-east-1.amazonaws.com') as NodeJS.ErrnoException;
        ebusy.code = 'EBUSY';
        mockSend.mockRejectedValueOnce(ebusy).mockResolvedValueOnce({});

        await sendSQSMessage(body, queueUrl, undefined, 5);

        expect(mockSend).toHaveBeenCalledTimes(2);
    });
});
