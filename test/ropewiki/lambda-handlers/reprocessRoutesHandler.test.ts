import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { reprocessRoutesHandler } from '../../../src/ropewiki/lambda-handlers/reprocessRoutesHandler';
import type RopewikiPage from '../../../src/ropewiki/types/page';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetAllPages: jest.MockedFunction<typeof import('../../../src/ropewiki/database/getAllPages').default>;
let mockProcessRoutes: jest.MockedFunction<typeof import('../../../src/ropewiki/processors/processRoutes').default>;

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

jest.mock('../../../src/ropewiki/processors/processRoutes', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleLogSpy: ReturnType<typeof jest.spyOn>;
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('reprocessRoutesHandler', () => {
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
        mockProcessRoutes = require('../../../src/ropewiki/processors/processRoutes').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetAllPages.mockResolvedValue([]);
        mockProcessRoutes.mockResolvedValue(undefined);
    });

    it('gets connection, fetches all pages, calls processRoutes with lambda hook, and returns 200', async () => {
        const mockPages = [{ id: 'page-1', pageid: '1', name: 'Page 1' }] as unknown as RopewikiPage[];
        mockGetAllPages.mockResolvedValue(mockPages);

        const result = await reprocessRoutesHandler();

        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockGetAllPages).toHaveBeenCalledWith(mockClient);
        expect(consoleLogSpy).toHaveBeenCalledWith('Reprocessing routes for all 1 pages...');
        expect(mockProcessRoutes).toHaveBeenCalledTimes(1);
        expect(mockProcessRoutes).toHaveBeenCalledWith(
            mockClient,
            mockPages,
            expect.any(Function),
        );
        expect(result).toEqual({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Ropewiki route reprocessor completed successfully',
            }),
        });
    });

    it('returns 200 and logs zero when no pages exist', async () => {
        mockGetAllPages.mockResolvedValue([]);

        const result = await reprocessRoutesHandler();

        expect(consoleLogSpy).toHaveBeenCalledWith('Reprocessing routes for all 0 pages...');
        expect(mockProcessRoutes).toHaveBeenCalledWith(mockClient, [], expect.any(Function));
        expect(result.statusCode).toBe(200);
    });

    it('handles getDatabaseConnection failure and returns 500', async () => {
        const error = new Error('Connection failed');
        mockGetDatabaseConnection.mockRejectedValue(error);

        const result = await reprocessRoutesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in Ropewiki route reprocessor:', error);
        expect(mockGetAllPages).not.toHaveBeenCalled();
        expect(mockProcessRoutes).not.toHaveBeenCalled();
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki route reprocessor failed',
                error: 'Connection failed',
            }),
        });
    });

    it('handles getAllPages failure and returns 500', async () => {
        const error = new Error('Query failed');
        mockGetAllPages.mockRejectedValue(error);

        const result = await reprocessRoutesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in Ropewiki route reprocessor:', error);
        expect(mockProcessRoutes).not.toHaveBeenCalled();
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki route reprocessor failed',
                error: 'Query failed',
            }),
        });
    });

    it('handles processRoutes failure and returns 500', async () => {
        const error = new Error('Process routes failed');
        mockProcessRoutes.mockRejectedValue(error);

        const result = await reprocessRoutesHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in Ropewiki route reprocessor:', error);
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki route reprocessor failed',
                error: 'Process routes failed',
            }),
        });
    });

    it('handles non-Error in catch and returns 500', async () => {
        mockGetAllPages.mockRejectedValue('string error');

        const result = await reprocessRoutesHandler();

        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki route reprocessor failed',
                error: 'string error',
            }),
        });
    });
});
