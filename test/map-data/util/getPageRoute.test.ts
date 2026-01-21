import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import getPageRoute from '../../../src/map-data/util/getPageRoute';
import { PageDataSource } from '../../../src/map-data/types/mapData';
import { PageRoute, RopewikiRoute } from '../../../src/types/pageRoute';
import * as db from 'zapatos/db';

// Mock the ropewiki database function
jest.mock('../../../src/ropewiki/database/getRopewikiRoute', () => {
    return {
        __esModule: true,
        default: jest.fn(),
    };
});

describe('getPageRoute', () => {
    let mockConn: db.Queryable;
    let mockGetRopewikiRoute: jest.MockedFunction<typeof import('../../../src/ropewiki/database/getRopewikiRoute').default>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConn = {} as db.Queryable;
        const getRopewikiRouteModule = require('../../../src/ropewiki/database/getRopewikiRoute');
        mockGetRopewikiRoute = getRopewikiRouteModule.default;
    });

    it('returns PageRoute for Ropewiki data source when route exists', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const mapDataId = '22222222-2222-2222-2222-222222222222';
        
        const mockRopewikiRoute = new RopewikiRoute(routeId, pageId, mapDataId);
        mockGetRopewikiRoute.mockResolvedValue(mockRopewikiRoute);

        const result = await getPageRoute(mockConn, PageDataSource.Ropewiki, pageId, routeId);

        expect(result).toBeDefined();
        expect(result).toBeInstanceOf(PageRoute);
        expect(result?.route).toBe(routeId);
        expect(result?.page).toBe(pageId);
        expect(result?.mapData).toBe(mapDataId);
        expect(mockGetRopewikiRoute).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiRoute).toHaveBeenCalledWith(mockConn, routeId, pageId);
    });

    it('returns undefined for Ropewiki data source when route does not exist', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        
        mockGetRopewikiRoute.mockResolvedValue(undefined);

        const result = await getPageRoute(mockConn, PageDataSource.Ropewiki, pageId, routeId);

        expect(result).toBeUndefined();
        expect(mockGetRopewikiRoute).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiRoute).toHaveBeenCalledWith(mockConn, routeId, pageId);
    });

    it('returns PageRoute without mapData when route exists without mapData', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        
        const mockRopewikiRoute = new RopewikiRoute(routeId, pageId);
        mockGetRopewikiRoute.mockResolvedValue(mockRopewikiRoute);

        const result = await getPageRoute(mockConn, PageDataSource.Ropewiki, pageId, routeId);

        expect(result).toBeDefined();
        expect(result?.route).toBe(routeId);
        expect(result?.page).toBe(pageId);
        expect(result?.mapData).toBeUndefined();
    });

    it('propagates errors from getRopewikiRoute', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const error = new Error('Database error');
        
        mockGetRopewikiRoute.mockRejectedValue(error);

        await expect(
            getPageRoute(mockConn, PageDataSource.Ropewiki, pageId, routeId),
        ).rejects.toThrow('Database error');
    });
});
