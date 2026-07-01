import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import getDatabaseConnection, { resetDatabaseConnectionPool } from '../../../src/helpers/getDatabaseConnection';
import { processAllFolders } from '../../../src/fargate-tasks/buildDownloadFolders/processors/processAllFolders';
import { main } from '../../../src/fargate-tasks/buildDownloadFolders/main';

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
    resetDatabaseConnectionPool: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../src/fargate-tasks/buildDownloadFolders/processors/processAllFolders', () => ({
    processAllFolders: jest.fn(),
}));

describe('main (buildDownloadFolders)', () => {
    let mockRelease: ReturnType<typeof jest.fn>;
    let mockResetDatabaseConnectionPool: jest.MockedFunction<typeof resetDatabaseConnectionPool>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRelease = jest.fn();
        mockResetDatabaseConnectionPool = jest.mocked(resetDatabaseConnectionPool);
        const mockPool = { connect: jest.fn() };
        // @ts-expect-error - mock pool client shape for test
        (mockPool.connect as jest.Mock).mockResolvedValue({ release: mockRelease });
        jest.mocked(getDatabaseConnection).mockResolvedValue(
            mockPool as unknown as Awaited<ReturnType<typeof getDatabaseConnection>>,
        );
        jest.mocked(processAllFolders).mockResolvedValue({
            built: 1,
            skipped: 0,
            failed: 1,
            total: 2,
        });
    });

    it('logs when no pages need download folders', async () => {
        jest.mocked(processAllFolders).mockResolvedValue({
            built: 0,
            skipped: 0,
            failed: 0,
            total: 0,
        });
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await main();

        expect(logSpy).toHaveBeenCalledWith('No pages need download folder builds.');
        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockResetDatabaseConnectionPool).toHaveBeenCalledTimes(1);
        logSpy.mockRestore();
    });

    it('logs summary counts from processAllFolders', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await main();

        expect(processAllFolders).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(
            'buildDownloadFolders complete: built=1 skipped=0 failed=1 total=2',
        );
        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockResetDatabaseConnectionPool).toHaveBeenCalledTimes(1);
        logSpy.mockRestore();
    });

    it('logs errors, rethrows, and cleans up when processAllFolders fails', async () => {
        const err = new Error('process failed');
        jest.mocked(processAllFolders).mockRejectedValue(err);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('process failed');

        expect(errorSpy).toHaveBeenCalledWith(err);
        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockResetDatabaseConnectionPool).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });

    it('cleans up when getDatabaseConnection fails', async () => {
        const err = new Error('db connection failed');
        jest.mocked(getDatabaseConnection).mockRejectedValue(err);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('db connection failed');

        expect(errorSpy).toHaveBeenCalledWith(err);
        expect(mockResetDatabaseConnectionPool).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });
});
