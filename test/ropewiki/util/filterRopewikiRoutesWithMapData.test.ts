import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import filterRopewikiRoutesWithMapData from '../../../src/ropewiki/util/filterRopewikiRoutesWithMapData';
import RopewikiRoute from '../../../src/types/pageRoute';
import filterPagesWithKmlUrl from '../../../src/ropewiki/database/filterPagesWithKmlUrl';
import * as db from 'zapatos/db';

// Mock the database function
jest.mock('../../../src/ropewiki/database/filterPagesWithKmlUrl');

const mockFilterPagesWithKmlUrl = filterPagesWithKmlUrl as jest.MockedFunction<typeof filterPagesWithKmlUrl>;

describe('filterRopewikiRoutesWithMapData', () => {
    const mockConn = {} as db.Queryable;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRopewikiRoute = (routeId: string, pageId: string, mapDataId?: string): RopewikiRoute => {
        return new RopewikiRoute(routeId, pageId, mapDataId);
    };

    it('returns all routes when all pages have KML URLs', async () => {
        const route1 = createRopewikiRoute('route-1', 'page-1');
        const route2 = createRopewikiRoute('route-2', 'page-2');
        const routes = [route1, route2];

        mockFilterPagesWithKmlUrl.mockResolvedValue(['page-1', 'page-2']);

        const result = await filterRopewikiRoutesWithMapData(mockConn, routes);

        expect(result).toHaveLength(2);
        expect(result).toContain(route1);
        expect(result).toContain(route2);
        expect(mockFilterPagesWithKmlUrl).toHaveBeenCalledTimes(1);
        expect(mockFilterPagesWithKmlUrl).toHaveBeenCalledWith(mockConn, ['page-1', 'page-2']);
    });

    it('filters out routes whose pages do not have KML URLs', async () => {
        const routeWithKml = createRopewikiRoute('route-1', 'page-with-kml');
        const routeWithoutKml = createRopewikiRoute('route-2', 'page-without-kml');
        const routes = [routeWithKml, routeWithoutKml];

        mockFilterPagesWithKmlUrl.mockResolvedValue(['page-with-kml']);

        const result = await filterRopewikiRoutesWithMapData(mockConn, routes);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(routeWithKml);
        expect(result).not.toContain(routeWithoutKml);
        expect(mockFilterPagesWithKmlUrl).toHaveBeenCalledWith(mockConn, ['page-with-kml', 'page-without-kml']);
    });

    it('returns empty array when no pages have KML URLs', async () => {
        const route1 = createRopewikiRoute('route-1', 'page-1');
        const route2 = createRopewikiRoute('route-2', 'page-2');
        const routes = [route1, route2];

        mockFilterPagesWithKmlUrl.mockResolvedValue([]);

        const result = await filterRopewikiRoutesWithMapData(mockConn, routes);

        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
        expect(mockFilterPagesWithKmlUrl).toHaveBeenCalledWith(mockConn, ['page-1', 'page-2']);
    });

    it('returns empty array when input is empty', async () => {
        const result = await filterRopewikiRoutesWithMapData(mockConn, []);

        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
        expect(mockFilterPagesWithKmlUrl).not.toHaveBeenCalled();
    });

    it('handles mixed array with some pages having KML URLs', async () => {
        const route1 = createRopewikiRoute('route-1', 'page-with-kml-1');
        const route2 = createRopewikiRoute('route-2', 'page-without-kml-1');
        const route3 = createRopewikiRoute('route-3', 'page-with-kml-2');
        const route4 = createRopewikiRoute('route-4', 'page-without-kml-2');
        const routes = [route1, route2, route3, route4];

        mockFilterPagesWithKmlUrl.mockResolvedValue(['page-with-kml-1', 'page-with-kml-2']);

        const result = await filterRopewikiRoutesWithMapData(mockConn, routes);

        expect(result).toHaveLength(2);
        expect(result).toContain(route1);
        expect(result).toContain(route3);
        expect(result).not.toContain(route2);
        expect(result).not.toContain(route4);
        expect(mockFilterPagesWithKmlUrl).toHaveBeenCalledWith(
            mockConn,
            ['page-with-kml-1', 'page-without-kml-1', 'page-with-kml-2', 'page-without-kml-2']
        );
    });

    it('preserves route order', async () => {
        const route1 = createRopewikiRoute('route-1', 'page-1');
        const route2 = createRopewikiRoute('route-2', 'page-2');
        const route3 = createRopewikiRoute('route-3', 'page-3');
        const routes = [route1, route2, route3];

        mockFilterPagesWithKmlUrl.mockResolvedValue(['page-1', 'page-2', 'page-3']);

        const result = await filterRopewikiRoutesWithMapData(mockConn, routes);

        expect(result).toHaveLength(3);
        expect(result[0]).toBe(route1);
        expect(result[1]).toBe(route2);
        expect(result[2]).toBe(route3);
    });

    it('handles routes with duplicate page IDs correctly', async () => {
        const route1 = createRopewikiRoute('route-1', 'page-1');
        const route2 = createRopewikiRoute('route-2', 'page-1'); // Same page ID
        const route3 = createRopewikiRoute('route-3', 'page-2');
        const routes = [route1, route2, route3];

        mockFilterPagesWithKmlUrl.mockResolvedValue(['page-1', 'page-2']);

        const result = await filterRopewikiRoutesWithMapData(mockConn, routes);

        expect(result).toHaveLength(3);
        expect(result).toContain(route1);
        expect(result).toContain(route2);
        expect(result).toContain(route3);
        expect(mockFilterPagesWithKmlUrl).toHaveBeenCalledWith(mockConn, ['page-1', 'page-1', 'page-2']);
    });

    it('handles routes with mapDataId', async () => {
        const route1 = createRopewikiRoute('route-1', 'page-1', 'map-data-1');
        const route2 = createRopewikiRoute('route-2', 'page-2');
        const routes = [route1, route2];

        mockFilterPagesWithKmlUrl.mockResolvedValue(['page-1', 'page-2']);

        const result = await filterRopewikiRoutesWithMapData(mockConn, routes);

        expect(result).toHaveLength(2);
        expect(result[0]?.mapData).toBe('map-data-1');
        expect(result[1]?.mapData).toBeUndefined();
    });

    it('propagates errors from filterPagesWithKmlUrl', async () => {
        const route1 = createRopewikiRoute('route-1', 'page-1');
        const routes = [route1];

        const dbError = new Error('Database connection failed');
        mockFilterPagesWithKmlUrl.mockRejectedValue(dbError);

        await expect(
            filterRopewikiRoutesWithMapData(mockConn, routes)
        ).rejects.toThrow('Database connection failed');
    });
});
