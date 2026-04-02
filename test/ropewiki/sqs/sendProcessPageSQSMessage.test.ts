import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import sendProcessPageSQSMessage from '../../../src/ropewiki/sqs/sendProcessPageSQSMessage';
import RopewikiPage from '../../../src/ropewiki/types/page';

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    sendSQSMessage: jest.fn(),
}));

const sendSQSMessage = require('ropegeo-common/helpers')
    .sendSQSMessage as jest.MockedFunction<typeof import('ropegeo-common/helpers').sendSQSMessage>;

function createTestPage(overrides: { id?: string; name?: string } = {}): RopewikiPage {
    const page = new RopewikiPage(
        '12345',
        overrides.name ?? 'Test Page',
        '00000000-0000-0000-0000-000000000001',
        'https://ropewiki.com/Test_Page',
        new Date('2025-01-01T00:00:00Z'),
    );
    if (overrides.id !== undefined) {
        (page as { id: string | undefined }).id = overrides.id;
    }
    return page;
}

describe('sendProcessPageSQSMessage', () => {
    const originalEnv = process.env;
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        sendSQSMessage.mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
    });

    it('returns without sending when DEV_ENVIRONMENT is "local"', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const page = createTestPage({ id: 'page-uuid-123' });

        await sendProcessPageSQSMessage(page);

        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Skipping SQS message sending for page Test Page - no queue configured locally',
        );
        expect(sendSQSMessage).not.toHaveBeenCalled();
    });

    it('sends message with body when not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/ropewiki-queue';
        const page = createTestPage({ id: 'page-uuid-456' });

        await sendProcessPageSQSMessage(page);

        expect(sendSQSMessage).toHaveBeenCalledTimes(1);
        expect(sendSQSMessage).toHaveBeenCalledWith(
            expect.any(String),
            'https://sqs.us-east-1.amazonaws.com/123456789/ropewiki-queue',
        );
        const bodyArg = sendSQSMessage.mock.calls[0]![0];
        expect(() => JSON.parse(bodyArg)).not.toThrow();
        const parsed = JSON.parse(bodyArg);
        expect(parsed.pageid).toBe('12345');
        expect(parsed.name).toBe('Test Page');
        expect(parsed.id).toBe('page-uuid-456');
    });

    it('throws when page.id is undefined and not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
        const page = createTestPage();
        (page as { id: string | undefined }).id = undefined;

        await expect(sendProcessPageSQSMessage(page)).rejects.toThrow(
            'RopewikiPage must have an id to send to queue',
        );

        expect(sendSQSMessage).not.toHaveBeenCalled();
    });

    it('throws when page.id is null and not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
        const page = createTestPage();
        (page as { id: string | null }).id = null;

        await expect(sendProcessPageSQSMessage(page)).rejects.toThrow(
            'RopewikiPage must have an id to send to queue',
        );

        expect(sendSQSMessage).not.toHaveBeenCalled();
    });

    it('throws when ROPEWIKI_PAGE_PROCESSING_QUEUE_URL is not set and not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL;
        const page = createTestPage({ id: 'page-uuid' });

        await expect(sendProcessPageSQSMessage(page)).rejects.toThrow(
            'ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set',
        );

        expect(sendSQSMessage).not.toHaveBeenCalled();
    });

    it('does not throw when DEV_ENVIRONMENT is "dev" and sends message', async () => {
        process.env.DEV_ENVIRONMENT = 'dev';
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
        const page = createTestPage({ id: 'page-uuid' });

        await sendProcessPageSQSMessage(page);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(sendSQSMessage).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from sendSQSMessage', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
        const page = createTestPage({ id: 'page-uuid' });
        sendSQSMessage.mockRejectedValue(new Error('SQS send failed'));

        await expect(sendProcessPageSQSMessage(page)).rejects.toThrow('SQS send failed');

        expect(sendSQSMessage).toHaveBeenCalledTimes(1);
    });
});
