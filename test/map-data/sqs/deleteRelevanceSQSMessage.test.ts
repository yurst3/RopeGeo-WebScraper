import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import deleteRelevanceSQSMessage from '../../../src/map-data/sqs/deleteRelevanceSQSMessage';

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    deleteSQSMessage: jest.fn(),
}));

const deleteSQSMessage = require('ropegeo-common/helpers')
    .deleteSQSMessage as jest.MockedFunction<
    typeof import('ropegeo-common/helpers').deleteSQSMessage
>;

describe('deleteRelevanceSQSMessage', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        deleteSQSMessage.mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('skips deletion when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await deleteRelevanceSQSMessage('rh');

        expect(consoleSpy).toHaveBeenCalledWith(
            'Skipping relevance SQS message deletion - no queue configured locally',
        );
        expect(deleteSQSMessage).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('deletes using MAP_DATA_RELEVANCE_QUEUE_URL', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_RELEVANCE_QUEUE_URL = 'https://sqs.example.com/q.fifo';

        await deleteRelevanceSQSMessage('rh');

        expect(deleteSQSMessage).toHaveBeenCalledWith('https://sqs.example.com/q.fifo', 'rh');
    });

    it('throws when MAP_DATA_RELEVANCE_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.MAP_DATA_RELEVANCE_QUEUE_URL;

        await expect(deleteRelevanceSQSMessage('rh')).rejects.toThrow(
            'MAP_DATA_RELEVANCE_QUEUE_URL environment variable is not set',
        );
    });
});
