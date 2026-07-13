import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import setRelevanceSQSMessageVisibilityTimeout from '../../../src/map-data/sqs/setRelevanceSQSMessageVisibilityTimeout';

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    changeSQSMessageVisibilityTimeout: jest.fn(),
}));

const changeSQSMessageVisibilityTimeout = require('ropegeo-common/helpers')
    .changeSQSMessageVisibilityTimeout as jest.MockedFunction<
    typeof import('ropegeo-common/helpers').changeSQSMessageVisibilityTimeout
>;

describe('setRelevanceSQSMessageVisibilityTimeout', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        changeSQSMessageVisibilityTimeout.mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('uses MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS by default', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_RELEVANCE_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/q.fifo';
        process.env.MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS = '900';

        await setRelevanceSQSMessageVisibilityTimeout('rh');

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123/q.fifo',
            'rh',
            900,
        );
    });

    it('allows overriding visibility timeout (e.g. 0 to requeue)', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.MAP_DATA_RELEVANCE_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/q.fifo';
        process.env.MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS = '900';

        await setRelevanceSQSMessageVisibilityTimeout('rh', 0);

        expect(changeSQSMessageVisibilityTimeout).toHaveBeenCalledWith(
            'https://sqs.us-east-1.amazonaws.com/123/q.fifo',
            'rh',
            0,
        );
    });
});
