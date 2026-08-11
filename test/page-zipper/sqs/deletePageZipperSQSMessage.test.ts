import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import deletePageZipperSQSMessage from '../../../src/page-zipper/sqs/deletePageZipperSQSMessage';

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    deleteSQSMessage: jest.fn(),
}));

const deleteSQSMessage = require('ropegeo-common/helpers')
    .deleteSQSMessage as jest.MockedFunction<
    typeof import('ropegeo-common/helpers').deleteSQSMessage
>;

describe('deletePageZipperSQSMessage', () => {
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

        await deletePageZipperSQSMessage('rh');

        expect(consoleSpy).toHaveBeenCalledWith(
            'Skipping page zipper SQS message deletion - no queue configured locally',
        );
        expect(deleteSQSMessage).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('deletes using PAGE_ZIPPER_QUEUE_URL', async () => {
        delete process.env.DEV_ENVIRONMENT;
        process.env.PAGE_ZIPPER_QUEUE_URL = 'https://sqs.example.com/q.fifo';

        await deletePageZipperSQSMessage('rh');

        expect(deleteSQSMessage).toHaveBeenCalledWith('https://sqs.example.com/q.fifo', 'rh');
    });

    it('throws when PAGE_ZIPPER_QUEUE_URL is not set', async () => {
        delete process.env.DEV_ENVIRONMENT;
        delete process.env.PAGE_ZIPPER_QUEUE_URL;

        await expect(deletePageZipperSQSMessage('rh')).rejects.toThrow(
            'PAGE_ZIPPER_QUEUE_URL environment variable is not set',
        );
    });
});
