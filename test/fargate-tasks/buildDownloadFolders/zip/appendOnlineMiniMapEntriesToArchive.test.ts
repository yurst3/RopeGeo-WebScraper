import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MiniMapType } from 'ropegeo-common/models';

jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/zip/appendTileEntriesToArchive', () => ({
    appendTileEntriesToArchive: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/zip/buildRegionRoutesGeoJson', () => ({
    buildRegionRoutesGeoJson: jest.fn(),
}));

import { appendOnlineMiniMapEntriesToArchive } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/appendOnlineMiniMapEntriesToArchive';
import { appendTileEntriesToArchive } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/appendTileEntriesToArchive';
import { buildRegionRoutesGeoJson } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/buildRegionRoutesGeoJson';

describe('appendOnlineMiniMapEntriesToArchive', () => {
    let originalEnv: NodeJS.ProcessEnv;
    const mockConn = {};
    const regionId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
    const mapDataId = 'cccccccc-dddd-4eee-ffff-000000000001';

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = {
            ...originalEnv,
            MAP_DATA_BUCKET_NAME: 'map-data-bucket',
        };
        jest.mocked(appendTileEntriesToArchive).mockResolvedValue(undefined);
        jest.mocked(buildRegionRoutesGeoJson).mockResolvedValue('{"type":"FeatureCollection","features":[]}');
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('does nothing when minimap is missing or offline', async () => {
        const archive = { append: jest.fn() };

        await appendOnlineMiniMapEntriesToArchive(archive as never, mockConn as never, regionId, {
            miniMap: null,
        } as never);
        await appendOnlineMiniMapEntriesToArchive(archive as never, mockConn as never, regionId, {
            miniMap: { fetchType: 'offline' },
        } as never);

        expect(appendTileEntriesToArchive).not.toHaveBeenCalled();
        expect(buildRegionRoutesGeoJson).not.toHaveBeenCalled();
        expect(archive.append).not.toHaveBeenCalled();
    });

    it('appends page-type minimap tiles when mapDataId and tileCount are set', async () => {
        const archive = { append: jest.fn() };

        await appendOnlineMiniMapEntriesToArchive(archive as never, mockConn as never, regionId, {
            miniMap: {
                fetchType: 'online',
                miniMapType: MiniMapType.Page,
                mapDataId,
                tileCount: 2,
            },
        } as never);

        expect(appendTileEntriesToArchive).toHaveBeenCalledWith(
            archive,
            'map-data-bucket',
            mapDataId,
        );
    });

    it('appends centered-region routes geojson when routeCount is positive', async () => {
        const archive = { append: jest.fn() };

        await appendOnlineMiniMapEntriesToArchive(archive as never, mockConn as never, regionId, {
            miniMap: {
                fetchType: 'online',
                miniMapType: MiniMapType.CenteredRegion,
                routeCount: 3,
            },
        } as never);

        expect(buildRegionRoutesGeoJson).toHaveBeenCalledWith(mockConn, regionId);
        expect(archive.append).toHaveBeenCalledWith(
            '{"type":"FeatureCollection","features":[]}',
            expect.objectContaining({ name: expect.stringContaining(regionId) }),
        );
    });
});
