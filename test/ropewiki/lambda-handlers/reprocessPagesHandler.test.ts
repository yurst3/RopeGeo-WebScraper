import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { reprocessPagesHandler } from '../../../src/ropewiki/lambda-handlers/reprocessPagesHandler';
import type RopewikiPage from '../../../src/ropewiki/types/page';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetAllPages: jest.MockedFunction<typeof import('../../../src/ropewiki/database/getAllPages').default>;
let mockSendProcessPageSQSMessage: jest.MockedFunction<typeof import('../../../src/ropewiki/sqs/sendProcessPageSQSMessage').default>;

let mockClient: { release: ReturnType<typeof jest.fn> };
let mockPool: { connect: ReturnType<typeof jest.fn>; end: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/ropewiki/database/getAllPages', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/ropewiki/sqs/sendProcessPageSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleLogSpy: ReturnType<typeof jest.spyOn>;
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('reprocessPagesHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
            end: jest.fn().mockResolvedValue(undefined),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockGetAllPages = require('../../../src/ropewiki/database/getAllPages').default;
        mockSendProcessPageSQSMessage = require('../../../src/ropewiki/sqs/sendProcessPageSQSMessage').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetAllPages.mockResolvedValue([]);
        mockSendProcessPageSQSMessage.mockResolvedValue(undefined);
    });

    it('gets connection, fetches all pages, sends SQS message for each, and returns 200', async () => {
        const mockPages = [
            { id: 'page-1', externalPageId: '1', name: 'Page 1' },
            { id: 'page-2', externalPageId: '2', name: 'Page 2' },
        ] as unknown as RopewikiPage[];
        mockGetAllPages.mockResolvedValue(mockPages);

        const result = await reprocessPagesHandler();

        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockGetAllPages).toHaveBeenCalledWith(mockClient);
        expect(consoleLogSpy).toHaveBeenCalledWith('Enqueueing 2 RopewikiPages for page processing...');
        expect(mockSendProcessPageSQSMessage).toHaveBeenCalledTimes(2);
        expect(mockSendProcessPageSQSMessage).toHaveBeenNthCalledWith(1, mockPages[0]);
        expect(mockSendProcessPageSQSMessage).toHaveBeenNthCalledWith(2, mockPages[1]);
        expect(result).toEqual({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki pages completed successfully',
                enqueuedCount: 2,
            }),
        });
    });

    it('returns 200 with enqueuedCount 0 when no pages exist', async () => {
        mockGetAllPages.mockResolvedValue([]);

        const result = await reprocessPagesHandler();

        expect(consoleLogSpy).toHaveBeenCalledWith('Enqueueing 0 RopewikiPages for page processing...');
        expect(mockSendProcessPageSQSMessage).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).enqueuedCount).toBe(0);
    });

    it('releases client on success', async () => {
        await reprocessPagesHandler();

        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('handles getDatabaseConnection failure and returns 500', async () => {
        const error = new Error('Connection failed');
        mockGetDatabaseConnection.mockRejectedValue(error);

        const result = await reprocessPagesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in RopewikiPageReprocessor:', error);
        expect(mockGetAllPages).not.toHaveBeenCalled();
        expect(mockSendProcessPageSQSMessage).not.toHaveBeenCalled();
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki pages failed',
                error: 'Connection failed',
            }),
        });
    });

    it('handles getAllPages failure and returns 500', async () => {
        const error = new Error('Query failed');
        mockGetAllPages.mockRejectedValue(error);

        const result = await reprocessPagesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in RopewikiPageReprocessor:', error);
        expect(mockSendProcessPageSQSMessage).not.toHaveBeenCalled();
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki pages failed',
                error: 'Query failed',
            }),
        });
    });

    it('handles sendProcessPageSQSMessage failure and returns 500', async () => {
        const mockPages = [{ id: 'page-1', externalPageId: '1', name: 'Page 1' }] as unknown as RopewikiPage[];
        mockGetAllPages.mockResolvedValue(mockPages);
        const error = new Error('SQS send failed');
        mockSendProcessPageSQSMessage.mockRejectedValue(error);

        const result = await reprocessPagesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in RopewikiPageReprocessor:', error);
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki pages failed',
                error: 'SQS send failed',
            }),
        });
    });

    it('handles non-Error in catch and returns 500', async () => {
        mockGetAllPages.mockRejectedValue('string error');

        const result = await reprocessPagesHandler();

        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Reprocess Ropewiki pages failed',
                error: 'string error',
            }),
        });
    });
});
