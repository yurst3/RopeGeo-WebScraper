import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OnlinePageMiniMap, Bounds } from 'ropegeo-common/models';

jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/processors/persistFolderZip', () => ({
    persistFolderZip: jest.fn(),
}));

import {
    processFolderForPage,
} from '../../../../src/fargate-tasks/buildDownloadFolders/processors/processFolderForPage';
import type { FolderSourceLoop } from '../../../../src/fargate-tasks/buildDownloadFolders/processors/processSourceFolders';
import { persistFolderZip } from '../../../../src/fargate-tasks/buildDownloadFolders/processors/persistFolderZip';

const mockConn = {};
const pageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
const regionId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
const mapDataId = 'cccccccc-dddd-4eee-ffff-000000000001';

const mockGetOnlinePageView = jest.fn<FolderSourceLoop['getOnlinePageView']>();
const mockGetPageForFolder = jest.fn<FolderSourceLoop['getPageForFolder']>();
const mockGetImageBundleRows = jest.fn<FolderSourceLoop['getImageBundleRows']>();
const mockUpdateFolderForPage = jest.fn<FolderSourceLoop['updateFolderForPage']>();

const loop: Pick<
    FolderSourceLoop,
    'getOnlinePageView' | 'getPageForFolder' | 'getImageBundleRows' | 'updateFolderForPage'
> = {
    getOnlinePageView: mockGetOnlinePageView,
    getPageForFolder: mockGetPageForFolder,
    getImageBundleRows: mockGetImageBundleRows,
    updateFolderForPage: mockUpdateFolderForPage,
};

describe('processFolderForPage', () => {
    let originalEnv: NodeJS.ProcessEnv;
    let mockView: NonNullable<Awaited<ReturnType<FolderSourceLoop['getOnlinePageView']>>>;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;

        const miniMap = new OnlinePageMiniMap(
            'poly',
            'point',
            'https://cdn.example.com/mapdata/tiles/x/{z}/{x}/{y}.pbf',
            new Bounds(1, 0, 1, 0),
            'Map',
            0,
            0,
            mapDataId,
        );
        mockView = {
            id: pageId,
            name: 'Test Page',
            miniMap,
            bannerImage: null,
            betaSections: [],
            toOffline: jest.fn().mockReturnValue({ id: pageId, fetchType: 'offline' }),
        } as unknown as NonNullable<Awaited<ReturnType<FolderSourceLoop['getOnlinePageView']>>>;

        mockGetOnlinePageView.mockResolvedValue(mockView);
        mockGetPageForFolder.mockResolvedValue({ region: regionId });
        mockGetImageBundleRows.mockResolvedValue([]);
        jest.mocked(persistFolderZip).mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws when page view is missing', async () => {
        mockGetOnlinePageView.mockResolvedValue(null);

        await expect(processFolderForPage(mockConn, pageId, loop)).rejects.toThrow(
            `Online page view not found: ${pageId}`,
        );
        expect(persistFolderZip).not.toHaveBeenCalled();
    });

    it('throws when page row is missing', async () => {
        mockGetPageForFolder.mockResolvedValue(null);

        await expect(processFolderForPage(mockConn, pageId, loop)).rejects.toThrow(
            `Page not found: ${pageId}`,
        );
        expect(persistFolderZip).not.toHaveBeenCalled();
    });

    it('loads page data and persists the download folder zip', async () => {
        await processFolderForPage(mockConn, pageId, loop);

        expect(mockGetImageBundleRows).toHaveBeenCalledWith(mockConn, pageId);
        expect(persistFolderZip).toHaveBeenCalledWith(
            mockConn,
            pageId,
            regionId,
            mockView,
            [],
            mockUpdateFolderForPage,
        );
    });
});
