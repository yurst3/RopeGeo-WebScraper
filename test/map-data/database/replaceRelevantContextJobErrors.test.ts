import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const deletesRun = jest.fn() as jest.MockedFunction<() => Promise<unknown[]>>;
const insertRun = jest.fn() as jest.MockedFunction<() => Promise<unknown[]>>;
const deletes = jest.fn(() => ({ run: deletesRun }));
const insert = jest.fn(() => ({ run: insertRun }));

jest.mock('zapatos/db', () => ({
    deletes: (...args: unknown[]) => deletes(...args),
    insert: (...args: unknown[]) => insert(...args),
}));

const replaceRelevantContextJobErrors =
    require('../../../src/map-data/database/replaceRelevantContextJobErrors')
        .default as typeof import('../../../src/map-data/database/replaceRelevantContextJobErrors').default;

describe('replaceRelevantContextJobErrors', () => {
    const mockConn = {} as any;

    beforeEach(() => {
        jest.clearAllMocks();
        deletesRun.mockResolvedValue([]);
        insertRun.mockResolvedValue([]);
    });

    it('deletes existing errors and inserts the new list', async () => {
        const errors = [
            {
                legendItemId: 'li-1',
                input: 'prompt-1',
                errorMessage: 'boom',
            },
        ];

        await replaceRelevantContextJobErrors(mockConn, 'job-1', errors);

        expect(deletes).toHaveBeenCalledWith('MapDataRelevantContextError', { jobId: 'job-1' });
        expect(insert).toHaveBeenCalledWith(
            'MapDataRelevantContextError',
            [
                expect.objectContaining({
                    jobId: 'job-1',
                    legendItemId: 'li-1',
                    input: 'prompt-1',
                    errorMessage: 'boom',
                }),
            ],
        );
        expect(insertRun).toHaveBeenCalledWith(mockConn);
    });

    it('only deletes when the replacement list is empty', async () => {
        await replaceRelevantContextJobErrors(mockConn, 'job-1', []);

        expect(deletes).toHaveBeenCalledWith('MapDataRelevantContextError', { jobId: 'job-1' });
        expect(insert).not.toHaveBeenCalled();
    });
});
