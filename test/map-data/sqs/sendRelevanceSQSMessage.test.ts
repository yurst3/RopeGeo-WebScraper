import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';
import sendRelevanceSQSMessage from '../../../src/map-data/sqs/sendRelevanceSQSMessage';

jest.mock('../../../src/map-data/sqs/sendFifoSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const sendFifoSQSMessage = require('../../../src/map-data/sqs/sendFifoSQSMessage')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/sqs/sendFifoSQSMessage').default
>;

describe('sendRelevanceSQSMessage', () => {
    const originalEnv = process.env;
    const message = {
        id: 'job-1',
        mapDataId: 'map-1',
        pageId: 'page-1',
        pageSource: PageDataSource.Ropewiki,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        sendFifoSQSMessage.mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws when MAP_DATA_RELEVANCE_QUEUE_URL is not set', async () => {
        delete process.env.MAP_DATA_RELEVANCE_QUEUE_URL;
        await expect(sendRelevanceSQSMessage(message)).rejects.toThrow(
            'MAP_DATA_RELEVANCE_QUEUE_URL environment variable is not set',
        );
    });

    it('sends a FIFO message with pageId group and job id deduplication', async () => {
        process.env.MAP_DATA_RELEVANCE_QUEUE_URL = 'https://sqs.example.com/q.fifo';

        await sendRelevanceSQSMessage(message);

        expect(sendFifoSQSMessage).toHaveBeenCalledWith({
            body: JSON.stringify(message),
            queueUrl: 'https://sqs.example.com/q.fifo',
            messageGroupId: 'page-1',
            messageDeduplicationId: 'job-1',
        });
    });
});
