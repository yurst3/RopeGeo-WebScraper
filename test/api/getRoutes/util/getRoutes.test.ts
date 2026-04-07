import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
    PageDataSource,
    PaginationParams,
    Route,
    RoutesParams,
    RouteType,
} from 'ropegeo-common/models';
import getRoutes from '../../../../src/api/getRoutes/util/getRoutes';

let mockCountAllRoutes: jest.MockedFunction<
    typeof import('../../../../src/api/getRoutes/database/getAllRoutes').countAllRoutes
>;
let mockGetAllRoutesPage: jest.MockedFunction<
    typeof import('../../../../src/api/getRoutes/database/getAllRoutes').getAllRoutesPage
>;
let mockCountRopewikiRegionRoutes: jest.MockedFunction<
    typeof import('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes').countRopewikiRegionRoutes
>;
let mockGetRopewikiRegionRoutesPage: jest.MockedFunction<
    typeof import('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes').getRopewikiRegionRoutesPage
>;

const mockClient = { release: jest.fn() };

jest.mock('../../../../src/api/getRoutes/database/getAllRoutes', () => ({
    __esModule: true,
    countAllRoutes: jest.fn(),
    getAllRoutesPage: jest.fn(),
}));

jest.mock('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes', () => ({
    __esModule: true,
    countRopewikiRegionRoutes: jest.fn(),
    getRopewikiRegionRoutesPage: jest.fn(),
}));

describe('getRoutes util', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const allRoutes = require('../../../../src/api/getRoutes/database/getAllRoutes');
        const regionRoutes = require('../../../../src/api/getRoutes/database/getRopewikiRegionRoutes');
        mockCountAllRoutes = allRoutes.countAllRoutes;
        mockGetAllRoutesPage = allRoutes.getAllRoutesPage;
        mockCountRopewikiRegionRoutes = regionRoutes.countRopewikiRegionRoutes;
        mockGetRopewikiRegionRoutesPage = regionRoutes.getRopewikiRegionRoutesPage;
        mockCountAllRoutes.mockResolvedValue(0);
        mockGetAllRoutesPage.mockResolvedValue([]);
        mockCountRopewikiRegionRoutes.mockResolvedValue(0);
        mockGetRopewikiRegionRoutesPage.mockResolvedValue([]);
    });

    it('calls count + page when params.region is null', async () => {
        const params = new RoutesParams({ region: null });
        await getRoutes(mockClient as never, params);

        expect(mockCountAllRoutes).toHaveBeenCalledTimes(1);
        expect(mockCountAllRoutes).toHaveBeenCalledWith(mockClient, {
            routeType: null,
            difficulty: null,
        });
        expect(mockGetAllRoutesPage).toHaveBeenCalledWith(
            mockClient,
            { routeType: null, difficulty: null },
            PaginationParams.DEFAULT_LIMIT,
            0,
        );
        expect(mockCountRopewikiRegionRoutes).not.toHaveBeenCalled();
        expect(mockGetRopewikiRegionRoutesPage).not.toHaveBeenCalled();
    });

    it('calls region count + page when params.region is set with source Ropewiki', async () => {
        const regionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const params = new RoutesParams({
            region: { id: regionId, source: [PageDataSource.Ropewiki] },
        });
        const mockRoutes: Route[] = [
            new Route('id-1', 'Region Route', RouteType.Canyon, { lat: 40.1, lon: -111.5 }),
        ];
        mockCountRopewikiRegionRoutes.mockResolvedValue(1);
        mockGetRopewikiRegionRoutesPage.mockResolvedValue(mockRoutes);

        const result = await getRoutes(mockClient as never, params);

        expect(mockCountRopewikiRegionRoutes).toHaveBeenCalledTimes(1);
        expect(mockCountRopewikiRegionRoutes).toHaveBeenCalledWith(mockClient, regionId, {
            routeType: null,
            difficulty: null,
        });
        expect(mockGetRopewikiRegionRoutesPage).toHaveBeenCalledWith(
            mockClient,
            regionId,
            { routeType: null, difficulty: null },
            PaginationParams.DEFAULT_LIMIT,
            0,
        );
        expect(mockCountAllRoutes).not.toHaveBeenCalled();
        expect(mockGetAllRoutesPage).not.toHaveBeenCalled();
        expect(result).toEqual({ routes: mockRoutes, total: 1 });
    });

    it('returns global list and total from count + page when params.region is null', async () => {
        const params = new RoutesParams({ region: null });
        const mockRoutes: Route[] = [
            new Route('id-1', 'All Route', RouteType.Cave, { lat: 41.0, lon: -112.0 }),
        ];
        mockCountAllRoutes.mockResolvedValue(100);
        mockGetAllRoutesPage.mockResolvedValue(mockRoutes);

        const result = await getRoutes(mockClient as never, params);

        expect(result).toEqual({ routes: mockRoutes, total: 100 });
    });

    it('returns region page and total when params.region is set', async () => {
        const regionId = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
        const params = new RoutesParams({
            region: { id: regionId, source: [PageDataSource.Ropewiki] },
        });
        const mockRoutes: Route[] = [
            new Route('id-2', 'Filtered', RouteType.POI, { lat: 40.0, lon: -111.0 }),
        ];
        mockCountRopewikiRegionRoutes.mockResolvedValue(5);
        mockGetRopewikiRegionRoutesPage.mockResolvedValue(mockRoutes);

        const result = await getRoutes(mockClient as never, params);

        expect(result).toEqual({ routes: mockRoutes, total: 5 });
    });
});
