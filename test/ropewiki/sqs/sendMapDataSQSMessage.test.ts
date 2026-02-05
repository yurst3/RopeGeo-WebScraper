import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import sendMapDataSQSMessage from '../../../src/ropewiki/sqs/sendMapDataSQSMessage';
import RopewikiRoute from '../../../src/types/pageRoute';

jest.mock('../../../src/helpers/sqs/sendSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const sendSQSMessage = require('../../../src/helpers/sqs/sendSQSMessage')
    .default as jest.MockedFunction<typeof import('../../../src/helpers/sqs/sendSQSMessage').default>;

function createTestRopewikiRoute(overrides: { route?: string; page?: string; mapData?: string } = {}): RopewikiRoute {
    return new RopewikiRoute(
        overrides.route ?? 'route-uuid-1',
        overrides.page ?? 'page-uuid-1',
        overrides.mapData,
    );
}

describe('sendMapDataSQSMessage', () => {
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
        const route = createTestRopewikiRoute({ route: 'r1', page: 'p1' });

        await sendMapDataSQSMessage(route);

        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Skipping SQS message sending for route r1 / page p1 - no queue configured locally',
        );
        expect(sendSQSMessage).not.toHaveBeenCalled();
    });

    it('sends message with body and attempts attribute when not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/map-data-queue';
        const route = createTestRopewikiRoute({ route: 'route-123', page: 'page-456' });

        await sendMapDataSQSMessage(route);

        expect(sendSQSMessage).toHaveBeenCalledTimes(1);
        expect(sendSQSMessage).toHaveBeenCalledWith(
            expect.any(String),
            'https://sqs.us-east-1.amazonaws.com/123456789/map-data-queue',
            { attempts: '0' },
        );
        const bodyArg = sendSQSMessage.mock.calls[0]![0];
        expect(() => JSON.parse(bodyArg)).not.toThrow();
        const parsed = JSON.parse(bodyArg);
        expect(parsed.source).toBe('ropewiki');
        expect(parsed.routeId).toBe('route-123');
        expect(parsed.pageId).toBe('page-456');
    });

    it('throws when route has no route and not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
        const route = createTestRopewikiRoute({ route: '', page: 'p1' });

        await expect(sendMapDataSQSMessage(route)).rejects.toThrow(
            'RopewikiRoute must have a route to send to queue',
        );

        expect(sendSQSMessage).not.toHaveBeenCalled();
    });

    it('throws when route has no page and not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
        const route = createTestRopewikiRoute({ route: 'r1', page: '' });

        await expect(sendMapDataSQSMessage(route)).rejects.toThrow(
            'RopewikiRoute must have a page to send to queue',
        );

        expect(sendSQSMessage).not.toHaveBeenCalled();
    });

    it('throws when MAP_DATA_PROCESSING_QUEUE_URL is not set and not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.MAP_DATA_PROCESSING_QUEUE_URL;
        const route = createTestRopewikiRoute({ route: 'r1', page: 'p1' });

        await expect(sendMapDataSQSMessage(route)).rejects.toThrow(
            'MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set',
        );

        expect(sendSQSMessage).not.toHaveBeenCalled();
    });

    it('does not throw when DEV_ENVIRONMENT is "dev" and sends message', async () => {
        process.env.DEV_ENVIRONMENT = 'dev';
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
        const route = createTestRopewikiRoute({ route: 'r1', page: 'p1' });

        await sendMapDataSQSMessage(route);

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(sendSQSMessage).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from sendSQSMessage', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
        const route = createTestRopewikiRoute({ route: 'r1', page: 'p1' });
        sendSQSMessage.mockRejectedValue(new Error('SQS send failed'));

        await expect(sendMapDataSQSMessage(route)).rejects.toThrow('SQS send failed');

        expect(sendSQSMessage).toHaveBeenCalledTimes(1);
    });
});
