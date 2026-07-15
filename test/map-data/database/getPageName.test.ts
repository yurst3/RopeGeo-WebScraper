import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';

const selectOneRun = jest.fn() as jest.MockedFunction<() => Promise<{ name: string } | undefined>>;
const selectOne = jest.fn(() => ({ run: selectOneRun }));

jest.mock('zapatos/db', () => ({
    selectOne: (...args: unknown[]) => selectOne(...args),
}));

const getPageName = require('../../../src/map-data/database/getPageName')
    .default as typeof import('../../../src/map-data/database/getPageName').default;

describe('getPageName', () => {
    const mockConn = {} as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the Ropewiki page name', async () => {
        selectOneRun.mockResolvedValue({ name: 'Roasting Dog Canyon' });

        await expect(
            getPageName(mockConn, 'page-1', PageDataSource.Ropewiki),
        ).resolves.toBe('Roasting Dog Canyon');

        expect(selectOne).toHaveBeenCalledWith(
            'RopewikiPage',
            { id: 'page-1' },
            { columns: ['name'] },
        );
    });

    it('returns undefined when the page is missing', async () => {
        selectOneRun.mockResolvedValue(undefined);

        await expect(
            getPageName(mockConn, 'missing', PageDataSource.Ropewiki),
        ).resolves.toBeUndefined();
    });
});
