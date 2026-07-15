import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const deletesRun = jest.fn() as jest.MockedFunction<() => Promise<{ id: string }[]>>;
const deletes = jest.fn(() => ({ run: deletesRun }));

jest.mock('zapatos/db', () => ({
    deletes: (...args: unknown[]) => deletes(...args),
}));

const deleteAllRelevantContextJobs =
    require('../../../src/map-data/database/deleteAllRelevantContextJobs')
        .default as typeof import('../../../src/map-data/database/deleteAllRelevantContextJobs').default;

describe('deleteAllRelevantContextJobs', () => {
    const mockConn = {} as any;

    beforeEach(() => {
        jest.clearAllMocks();
        deletesRun.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }]);
    });

    it('deletes all MapDataRelevantContextJob rows and returns the count', async () => {
        await expect(deleteAllRelevantContextJobs(mockConn)).resolves.toBe(2);
        expect(deletes).toHaveBeenCalledWith('MapDataRelevantContextJob', {});
        expect(deletesRun).toHaveBeenCalledWith(mockConn);
    });
});
