import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import upsertPageRoute from '../../../src/map-data/util/upsertPageRoute';
import { PageDataSource } from 'ropegeo-common/classes';
import { PageRoute, RopewikiRoute } from '../../../src/types/pageRoute';
import * as db from 'zapatos/db';

// Mock the ropewiki database function
jest.mock('../../../src/ropewiki/database/upsertRopewikiRoute', () => {
    return {
        __esModule: true,
        default: jest.fn(),
    };
});

describe('upsertPageRoute', () => {
    let mockConn: db.Queryable;
    let mockUpsertRopewikiRoute: jest.MockedFunction<typeof import('../../../src/ropewiki/database/upsertRopewikiRoute').default>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConn = {} as db.Queryable;
        const upsertRopewikiRouteModule = require('../../../src/ropewiki/database/upsertRopewikiRoute');
        mockUpsertRopewikiRoute = upsertRopewikiRouteModule.default;
    });

    it('upserts PageRoute for Ropewiki data source with mapData', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const mapDataId = '22222222-2222-2222-2222-222222222222';
        
        const pageRoute = new PageRoute(routeId, pageId, mapDataId);
        mockUpsertRopewikiRoute.mockResolvedValue(undefined);

        await upsertPageRoute(mockConn, PageDataSource.Ropewiki, pageRoute);

        expect(mockUpsertRopewikiRoute).toHaveBeenCalledTimes(1);
        const calledArg = mockUpsertRopewikiRoute.mock.calls[0]![1];
        expect(calledArg).toBeInstanceOf(PageRoute);
        expect(calledArg.route).toBe(routeId);
        expect(calledArg.page).toBe(pageId);
        expect(calledArg.mapData).toBe(mapDataId);
    });

    it('upserts PageRoute for Ropewiki data source without mapData', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        
        const pageRoute = new PageRoute(routeId, pageId);
        mockUpsertRopewikiRoute.mockResolvedValue(undefined);

        await upsertPageRoute(mockConn, PageDataSource.Ropewiki, pageRoute);

        expect(mockUpsertRopewikiRoute).toHaveBeenCalledTimes(1);
        const calledArg = mockUpsertRopewikiRoute.mock.calls[0]![1];
        expect(calledArg).toBeInstanceOf(PageRoute);
        expect(calledArg.route).toBe(routeId);
        expect(calledArg.page).toBe(pageId);
        expect(calledArg.mapData).toBeUndefined();
    });

    it('converts PageRoute to RopewikiRoute when upserting', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const mapDataId = '22222222-2222-2222-2222-222222222222';
        
        // Use base PageRoute class, not RopewikiRoute
        const pageRoute = new PageRoute(routeId, pageId, mapDataId);
        mockUpsertRopewikiRoute.mockResolvedValue(undefined);

        await upsertPageRoute(mockConn, PageDataSource.Ropewiki, pageRoute);

        expect(mockUpsertRopewikiRoute).toHaveBeenCalledTimes(1);
        const calledArg = mockUpsertRopewikiRoute.mock.calls[0]![1];
        // PageRoute is passed with a type cast to RopewikiRoute, but remains PageRoute at runtime
        expect(calledArg).toBeInstanceOf(PageRoute);
        expect(calledArg).toBe(pageRoute); // Verify it's the same object reference
    });

    it('propagates errors from upsertRopewikiRoute', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const pageRoute = new PageRoute(routeId, pageId);
        const error = new Error('Database error');
        
        mockUpsertRopewikiRoute.mockRejectedValue(error);

        await expect(
            upsertPageRoute(mockConn, PageDataSource.Ropewiki, pageRoute),
        ).rejects.toThrow('Database error');
    });

    it('handles multiple upserts correctly', async () => {
        const routeId1 = '11111111-1111-1111-1111-111111111111';
        const pageId1 = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const routeId2 = '22222222-2222-2222-2222-222222222222';
        const pageId2 = 'e2e9240e-49ec-544d-c8de-b39f80442778';
        
        const pageRoute1 = new PageRoute(routeId1, pageId1);
        const pageRoute2 = new PageRoute(routeId2, pageId2);
        mockUpsertRopewikiRoute.mockResolvedValue(undefined);

        await upsertPageRoute(mockConn, PageDataSource.Ropewiki, pageRoute1);
        await upsertPageRoute(mockConn, PageDataSource.Ropewiki, pageRoute2);

        expect(mockUpsertRopewikiRoute).toHaveBeenCalledTimes(2);
        expect(mockUpsertRopewikiRoute.mock.calls[0]![1].route).toBe(routeId1);
        expect(mockUpsertRopewikiRoute.mock.calls[0]![1].page).toBe(pageId1);
        expect(mockUpsertRopewikiRoute.mock.calls[1]![1].route).toBe(routeId2);
        expect(mockUpsertRopewikiRoute.mock.calls[1]![1].page).toBe(pageId2);
    });
});
