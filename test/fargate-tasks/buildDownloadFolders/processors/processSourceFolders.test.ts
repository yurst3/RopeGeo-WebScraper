import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';

jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/processors/processFolderForPage', () => ({
    processFolderForPage: jest.fn(),
}));

import {
    processSourceFolders,
    type FolderSourceLoop,
} from '../../../../src/fargate-tasks/buildDownloadFolders/processors/processSourceFolders';
import { processFolderForPage } from '../../../../src/fargate-tasks/buildDownloadFolders/processors/processFolderForPage';

const mockConn = {};
const pageIds = [
    'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
    'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
];
const mockGetOnlinePageView = jest.fn<FolderSourceLoop['getOnlinePageView']>();
const mockGetPageForFolder = jest.fn<FolderSourceLoop['getPageForFolder']>();
const mockGetImageBundleRows = jest.fn<FolderSourceLoop['getImageBundleRows']>();
const mockUpdateFolderForPage = jest.fn<FolderSourceLoop['updateFolderForPage']>();
const mockIsPageReadyForFolder = jest.fn<FolderSourceLoop['isPageReadyForFolder']>();

const loop: FolderSourceLoop = {
    pageDataSource: PageDataSource.Ropewiki,
    getPageIdsNeedingFolder: jest.fn(),
    getOnlinePageView: mockGetOnlinePageView,
    getPageForFolder: mockGetPageForFolder,
    getImageBundleRows: mockGetImageBundleRows,
    updateFolderForPage: mockUpdateFolderForPage,
    isPageReadyForFolder: mockIsPageReadyForFolder,
};

describe('processSourceFolders', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(loop.getPageIdsNeedingFolder).mockResolvedValue(pageIds);
        mockIsPageReadyForFolder.mockResolvedValue(true);
        jest.mocked(processFolderForPage).mockResolvedValue(undefined);
    });

    it('returns zero counts when no pages need download folders', async () => {
        jest.mocked(loop.getPageIdsNeedingFolder).mockResolvedValue([]);

        await expect(processSourceFolders(mockConn, loop)).resolves.toEqual({
            built: 0,
            skipped: 0,
            failed: 0,
            total: 0,
        });
        expect(mockIsPageReadyForFolder).not.toHaveBeenCalled();
        expect(processFolderForPage).not.toHaveBeenCalled();
    });

    it('returns built, skipped, and failed counts with per-page error isolation', async () => {
        mockIsPageReadyForFolder
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        jest.mocked(processFolderForPage).mockRejectedValueOnce(new Error('zip failed'));
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(processSourceFolders(mockConn, loop)).resolves.toEqual({
            built: 0,
            skipped: 1,
            failed: 1,
            total: 2,
        });

        expect(mockIsPageReadyForFolder).toHaveBeenCalledWith(mockConn, pageIds[0]);
        expect(processFolderForPage).toHaveBeenCalledTimes(1);
        expect(processFolderForPage).toHaveBeenCalledWith(
            mockConn,
            pageIds[0],
            loop,
        );
        expect(errorSpy).toHaveBeenCalledWith(
            `Failed to build download folder for ${PageDataSource.Ropewiki} page ${pageIds[0]}:`,
            expect.any(Error),
        );
        errorSpy.mockRestore();
    });

    it('returns built count for ready pages', async () => {
        await expect(processSourceFolders(mockConn, loop)).resolves.toEqual({
            built: 2,
            skipped: 0,
            failed: 0,
            total: 2,
        });
    });
});
