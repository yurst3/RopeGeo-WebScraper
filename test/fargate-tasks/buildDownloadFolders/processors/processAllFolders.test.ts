import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';

jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/processors/processSourceFolders', () => ({
    processSourceFolders: jest.fn(),
}));

import { processAllFolders } from '../../../../src/fargate-tasks/buildDownloadFolders/processors/processAllFolders';
import { processSourceFolders } from '../../../../src/fargate-tasks/buildDownloadFolders/processors/processSourceFolders';

const mockConn = {};

describe('processAllFolders', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(processSourceFolders).mockResolvedValue({
            built: 2,
            skipped: 0,
            failed: 0,
            total: 2,
        });
    });

    it('runs one loop per page data source in parallel and merges counts', async () => {
        await expect(processAllFolders(mockConn)).resolves.toEqual({
            built: 2,
            skipped: 0,
            failed: 0,
            total: 2,
        });

        expect(processSourceFolders).toHaveBeenCalledTimes(1);
        expect(processSourceFolders).toHaveBeenCalledWith(
            mockConn,
            expect.objectContaining({ pageDataSource: PageDataSource.Ropewiki }),
        );
    });

    it('returns zero counts when all source loops are empty', async () => {
        jest.mocked(processSourceFolders).mockResolvedValue({
            built: 0,
            skipped: 0,
            failed: 0,
            total: 0,
        });

        await expect(processAllFolders(mockConn)).resolves.toEqual({
            built: 0,
            skipped: 0,
            failed: 0,
            total: 0,
        });
    });
});
