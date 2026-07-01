import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MiniMapType } from 'ropegeo-common/models';

jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/database/getMapDataForFolderReadiness', () => ({
    getMapDataForFolderReadiness: jest.fn(),
}));
jest.mock('../../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes', () => ({
    getRopewikiRegionRouteStats: jest.fn(),
}));

import { isOnlineMiniMapReady } from '../../../../src/fargate-tasks/buildDownloadFolders/readiness/isOnlineMiniMapReady';
import { getMapDataForFolderReadiness } from '../../../../src/fargate-tasks/buildDownloadFolders/database/getMapDataForFolderReadiness';
import listAllPbfKeysAndTotalBytes from '../../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes';
import { getRopewikiRegionRouteStats } from '../../../../src/api/getRoutes/database/getRopewikiRegionRoutes';

const mockConn = {};
const regionId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
const mapDataId = 'cccccccc-dddd-4eee-ffff-000000000001';

describe('isOnlineMiniMapReady', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns true when minimap is missing or offline', async () => {
        await expect(isOnlineMiniMapReady(mockConn, regionId, { miniMap: null } as never)).resolves.toBe(true);
        await expect(
            isOnlineMiniMapReady(mockConn, regionId, { miniMap: { fetchType: 'offline' } } as never),
        ).resolves.toBe(true);
    });

    it('returns true for page minimap with zero tiles', async () => {
        await expect(
            isOnlineMiniMapReady(mockConn, regionId, {
                miniMap: {
                    fetchType: 'online',
                    miniMapType: MiniMapType.Page,
                    mapDataId,
                    tileCount: 0,
                },
            } as never),
        ).resolves.toBe(true);
        expect(getMapDataForFolderReadiness).not.toHaveBeenCalled();
    });

    it('returns false for page minimap missing mapDataId', async () => {
        await expect(
            isOnlineMiniMapReady(mockConn, regionId, {
                miniMap: {
                    fetchType: 'online',
                    miniMapType: MiniMapType.Page,
                    mapDataId: null,
                    tileCount: 2,
                },
            } as never),
        ).resolves.toBe(false);
    });

    it('returns false when S3 tile count does not match DB', async () => {
        jest.mocked(getMapDataForFolderReadiness).mockResolvedValue({
            errorMessage: null,
            tileCount: 2,
        });
        jest.mocked(listAllPbfKeysAndTotalBytes).mockResolvedValue({
            keys: ['tiles/x/0/0/0.pbf'],
            totalBytes: 100,
        });

        await expect(
            isOnlineMiniMapReady(mockConn, regionId, {
                miniMap: {
                    fetchType: 'online',
                    miniMapType: MiniMapType.Page,
                    mapDataId,
                    tileCount: 2,
                },
            } as never),
        ).resolves.toBe(false);
    });

    it('returns true when centered-region route count is satisfied', async () => {
        jest.mocked(getRopewikiRegionRouteStats).mockResolvedValue({ routeCount: 5, totalBytes: 0 });

        await expect(
            isOnlineMiniMapReady(mockConn, regionId, {
                miniMap: {
                    fetchType: 'online',
                    miniMapType: MiniMapType.CenteredRegion,
                    routeCount: 5,
                },
            } as never),
        ).resolves.toBe(true);
    });

    it('returns true for centered-region minimap with zero routes', async () => {
        await expect(
            isOnlineMiniMapReady(mockConn, regionId, {
                miniMap: {
                    fetchType: 'online',
                    miniMapType: MiniMapType.CenteredRegion,
                    routeCount: 0,
                },
            } as never),
        ).resolves.toBe(true);
        expect(getRopewikiRegionRouteStats).not.toHaveBeenCalled();
    });
});
