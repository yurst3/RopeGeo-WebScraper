import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource, Route, RoutesParams, RouteType } from 'ropegeo-common/classes';
import getRoutes from '../../../../src/api/getRoutes/util/getRoutes';

let mockGetAllRoutes: jest.MockedFunction<typeof import('../../../../src/api/getRoutes/database/getAllRoutes').default>;
let mockGetRopewikiRegionRoutes: jest.MockedFunction<
    typeof import('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes').default
>;

const mockClient = { release: jest.fn() };

jest.mock('../../../../src/api/getRoutes/database/getAllRoutes', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('getRoutes util', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAllRoutes = require('../../../../src/api/getRoutes/database/getAllRoutes').default;
        mockGetRopewikiRegionRoutes = require('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes').default;
        mockGetAllRoutes.mockResolvedValue([]);
        mockGetRopewikiRegionRoutes.mockResolvedValue([]);
    });

    it('calls getAllRoutes when params.region is null', async () => {
        const params = new RoutesParams({ region: null });
        await getRoutes(mockClient as never, params);

        expect(mockGetAllRoutes).toHaveBeenCalledTimes(1);
        expect(mockGetAllRoutes).toHaveBeenCalledWith(mockClient, {
            routeType: null,
            difficulty: null,
        });
        expect(mockGetRopewikiRegionRoutes).not.toHaveBeenCalled();
    });

    it('calls getRopewikiRegionRoutes when params.region is set with source Ropewiki', async () => {
        const regionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const params = new RoutesParams({
            region: { id: regionId, source: [PageDataSource.Ropewiki] },
        });
        const mockRoutes: Route[] = [
            new Route('id-1', 'Region Route', RouteType.Canyon, { lat: 40.1, lon: -111.5 }),
        ];
        mockGetRopewikiRegionRoutes.mockResolvedValue(mockRoutes);

        const result = await getRoutes(mockClient as never, params);

        expect(mockGetRopewikiRegionRoutes).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiRegionRoutes).toHaveBeenCalledWith(mockClient, regionId, {
            routeType: null,
            difficulty: null,
        });
        expect(mockGetAllRoutes).not.toHaveBeenCalled();
        expect(result).toEqual(mockRoutes);
    });

    it('returns result from getAllRoutes when params.region is null', async () => {
        const params = new RoutesParams({ region: null });
        const mockRoutes: Route[] = [
            new Route('id-1', 'All Route', RouteType.Cave, { lat: 41.0, lon: -112.0 }),
        ];
        mockGetAllRoutes.mockResolvedValue(mockRoutes);

        const result = await getRoutes(mockClient as never, params);

        expect(result).toEqual(mockRoutes);
    });

    it('returns result from getRopewikiRegionRoutes when params.region is set', async () => {
        const regionId = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
        const params = new RoutesParams({
            region: { id: regionId, source: [PageDataSource.Ropewiki] },
        });
        const mockRoutes: Route[] = [
            new Route('id-2', 'Filtered', RouteType.POI, { lat: 40.0, lon: -111.0 }),
        ];
        mockGetRopewikiRegionRoutes.mockResolvedValue(mockRoutes);

        const result = await getRoutes(mockClient as never, params);

        expect(result).toEqual(mockRoutes);
    });
});
