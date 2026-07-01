import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes', () => ({
    countRopewikiRegionRoutes: jest.fn(),
    getRopewikiRegionRoutesPage: jest.fn(),
}));

import {
    countRopewikiRegionRoutes,
    getRopewikiRegionRoutesPage,
} from '../../../../src/api/getRoutes/database/getRopewikiRegionRoutes';
import { buildRegionRoutesGeoJson } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/buildRegionRoutesGeoJson';

describe('buildRegionRoutesGeoJson', () => {
    const mockConn = {};
    const regionId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('merges paginated route features into a FeatureCollection', async () => {
        jest.mocked(countRopewikiRegionRoutes).mockResolvedValue(2);
        jest.mocked(getRopewikiRegionRoutesPage).mockResolvedValue([
            { toGeoJsonFeature: () => ({ type: 'Feature', properties: { id: 'route-1' } }) },
            { toGeoJsonFeature: () => ({ type: 'Feature', properties: { id: 'route-2' } }) },
        ] as never);

        await expect(buildRegionRoutesGeoJson(mockConn as never, regionId)).resolves.toBe(
            JSON.stringify({
                type: 'FeatureCollection',
                features: [
                    { type: 'Feature', properties: { id: 'route-1' } },
                    { type: 'Feature', properties: { id: 'route-2' } },
                ],
            }),
        );

        expect(getRopewikiRegionRoutesPage).toHaveBeenCalledWith(
            mockConn,
            regionId,
            expect.any(Object),
            500,
            0,
        );
    });

    it('returns an empty FeatureCollection when no routes exist', async () => {
        jest.mocked(countRopewikiRegionRoutes).mockResolvedValue(0);

        await expect(buildRegionRoutesGeoJson(mockConn as never, regionId)).resolves.toBe(
            JSON.stringify({ type: 'FeatureCollection', features: [] }),
        );
        expect(getRopewikiRegionRoutesPage).not.toHaveBeenCalled();
    });
});
