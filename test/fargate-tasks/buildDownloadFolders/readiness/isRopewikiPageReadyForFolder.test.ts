import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MiniMapType } from 'ropegeo-common/models';

jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/database/getRopewikiPageForFolderReadiness', () => ({
    getRopewikiPageForFolderReadiness: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/database/countUnprocessedRopewikiImagesForPage', () => ({
    countUnprocessedRopewikiImagesForPage: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/database/getMapDataForFolderReadiness', () => ({
    getMapDataForFolderReadiness: jest.fn(),
}));
jest.mock('../../../../src/api/getRopewikiPageView/database/getRopewikiPageView', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes', () => ({
    getRopewikiRegionRouteStats: jest.fn(),
}));

import { isRopewikiPageReadyForFolder } from '../../../../src/fargate-tasks/buildDownloadFolders/readiness/isRopewikiPageReadyForFolder';
import { getRopewikiPageForFolderReadiness } from '../../../../src/fargate-tasks/buildDownloadFolders/database/getRopewikiPageForFolderReadiness';
import { countUnprocessedRopewikiImagesForPage } from '../../../../src/fargate-tasks/buildDownloadFolders/database/countUnprocessedRopewikiImagesForPage';
import { getMapDataForFolderReadiness } from '../../../../src/fargate-tasks/buildDownloadFolders/database/getMapDataForFolderReadiness';
import getRopewikiPageView from '../../../../src/api/getRopewikiPageView/database/getRopewikiPageView';
import listAllPbfKeysAndTotalBytes from '../../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes';
import { getRopewikiRegionRouteStats } from '../../../../src/api/getRoutes/database/getRopewikiRegionRoutes';

const mockConn = {};
const pageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
const regionId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
const mapDataId = 'cccccccc-dddd-4eee-ffff-000000000001';

describe('isRopewikiPageReadyForFolder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getRopewikiPageForFolderReadiness).mockResolvedValue({
            id: pageId,
            deletedAt: null,
            region: regionId,
        });
        jest.mocked(countUnprocessedRopewikiImagesForPage).mockResolvedValue(0);
    });

    it('returns false when page is deleted', async () => {
        jest.mocked(getRopewikiPageForFolderReadiness).mockResolvedValue({
            id: pageId,
            deletedAt: '2025-01-01T00:00:00' as never,
            region: regionId,
        });

        await expect(isRopewikiPageReadyForFolder(mockConn, pageId)).resolves.toBe(false);
    });

    it('returns false when images are not fully processed', async () => {
        jest.mocked(countUnprocessedRopewikiImagesForPage).mockResolvedValue(1);

        await expect(isRopewikiPageReadyForFolder(mockConn, pageId)).resolves.toBe(false);
        expect(getRopewikiPageView).not.toHaveBeenCalled();
    });

    it('returns false when page minimap tiles are incomplete in S3', async () => {
        jest.mocked(getRopewikiPageView).mockResolvedValue({
            miniMap: {
                fetchType: 'online',
                miniMapType: MiniMapType.Page,
                mapDataId,
                tileCount: 2,
            },
        } as Awaited<ReturnType<typeof getRopewikiPageView>>);
        jest.mocked(getMapDataForFolderReadiness).mockResolvedValue({
            errorMessage: null,
            tileCount: 2,
        });
        jest.mocked(listAllPbfKeysAndTotalBytes).mockResolvedValue({ keys: ['tiles/x/0/0/0.pbf'], totalBytes: 100 });

        await expect(isRopewikiPageReadyForFolder(mockConn, pageId)).resolves.toBe(false);
    });

    it('returns true when page minimap tiles match DB count', async () => {
        jest.mocked(getRopewikiPageView).mockResolvedValue({
            miniMap: {
                fetchType: 'online',
                miniMapType: MiniMapType.Page,
                mapDataId,
                tileCount: 2,
            },
        } as Awaited<ReturnType<typeof getRopewikiPageView>>);
        jest.mocked(getMapDataForFolderReadiness).mockResolvedValue({
            errorMessage: null,
            tileCount: 2,
        });
        jest.mocked(listAllPbfKeysAndTotalBytes).mockResolvedValue({
            keys: ['tiles/x/0/0/0.pbf', 'tiles/x/0/0/1.pbf'],
            totalBytes: 200,
        });

        await expect(isRopewikiPageReadyForFolder(mockConn, pageId)).resolves.toBe(true);
    });

    it('returns false when centered-region routes are incomplete', async () => {
        jest.mocked(getRopewikiPageView).mockResolvedValue({
            miniMap: {
                fetchType: 'online',
                miniMapType: MiniMapType.CenteredRegion,
                routeCount: 5,
            },
        } as Awaited<ReturnType<typeof getRopewikiPageView>>);
        jest.mocked(getRopewikiRegionRouteStats).mockResolvedValue({ routeCount: 3, totalBytes: 0 });

        await expect(isRopewikiPageReadyForFolder(mockConn, pageId)).resolves.toBe(false);
    });
});
