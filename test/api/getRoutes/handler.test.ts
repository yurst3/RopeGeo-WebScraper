import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource, Route, RouteType } from 'ropegeo-common/classes';
import { handler } from '../../../src/api/getRoutes/handler';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetRoutes: jest.MockedFunction<typeof import('../../../src/api/getRoutes/util/getRoutes').default>;

let mockClient: { release: ReturnType<typeof jest.fn> };
let mockPool: { connect: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRoutes/util/getRoutes', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('getRoutes handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockGetRoutes = require('../../../src/api/getRoutes/util/getRoutes').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetRoutes.mockResolvedValue({ routes: [], total: 0 });
    });

    it('returns 200 and RouteResult (features, total, page) with CORS headers', async () => {
        const mockRoutes: Route[] = [
            new Route('id-1', 'Route One', RouteType.Canyon, { lat: 40.1, lon: -111.5 }),
        ];
        mockGetRoutes.mockResolvedValue({ routes: mockRoutes, total: 1 });

        const result = await handler({}, {});

        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockGetRoutes).toHaveBeenCalledWith(mockClient, expect.any(Object));
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        const body = JSON.parse(result.body);
        expect(body.resultType).toBe('route');
        expect(body.total).toBe(1);
        expect(body.page).toBe(1);
        expect(body.results).toEqual([
            {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-111.5, 40.1] },
                properties: { id: 'id-1', name: 'Route One', type: 'Canyon' },
            },
        ]);
    });

    it('returns 200 and empty results when no routes exist', async () => {
        mockGetRoutes.mockResolvedValue({ routes: [], total: 0 });

        const result = await handler({}, {});

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.resultType).toBe('route');
        expect(body.results).toEqual([]);
        expect(body.total).toBe(0);
        expect(body.page).toBe(1);
    });

    it('returns 400 when source is present but region is absent', async () => {
        const result = await handler(
            { queryStringParameters: { source: PageDataSource.Ropewiki } },
            {},
        );

        expect(mockGetRoutes).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(result.headers['Content-Type']).toBe('application/json');
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Bad Request');
        expect(body.error).toMatch(/source|region/);
    });

    it('returns 200 when region is present without source (all sources in subtree)', async () => {
        const regionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        mockGetRoutes.mockResolvedValue({ routes: [], total: 0 });

        const result = await handler(
            { queryStringParameters: { region: regionId } },
            {},
        );

        expect(mockGetRoutes).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(200);
        const routesParams = mockGetRoutes.mock.calls[0]![1];
        expect(routesParams.region).toEqual({ id: regionId, source: null });
    });

    it('returns 400 when source is invalid', async () => {
        const result = await handler(
            {
                queryStringParameters: {
                    source: 'invalid',
                    region: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                },
            },
            {},
        );

        expect(mockGetRoutes).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Bad Request');
        expect(body.error).toMatch(/source|ropewiki/);
    });

    it('calls getRoutes with RoutesParams when source and region are present and returns filtered page', async () => {
        const regionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const mockRoutes: Route[] = [
            new Route('id-2', 'Filtered Route', RouteType.Cave, { lat: 40.2, lon: -111.6 }),
        ];
        mockGetRoutes.mockResolvedValue({ routes: mockRoutes, total: 42 });

        const result = await handler(
            {
                queryStringParameters: {
                    source: PageDataSource.Ropewiki,
                    region: regionId,
                },
            },
            {},
        );

        expect(mockGetRoutes).toHaveBeenCalledWith(mockClient, expect.any(Object));
        const routesParams = mockGetRoutes.mock.calls[0]![1];
        expect(routesParams).toBeDefined();
        expect(routesParams.region).not.toBeNull();
        expect(routesParams.region!.source).toEqual([PageDataSource.Ropewiki]);
        expect(routesParams.region!.id).toBe(regionId);
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.resultType).toBe('route');
        expect(body.total).toBe(42);
        expect(body.page).toBe(1);
        expect(body.results).toEqual([
            {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-111.6, 40.2] },
                properties: { id: 'id-2', name: 'Filtered Route', type: 'Cave' },
            },
        ]);
    });

    it('handles getDatabaseConnection failure and returns 500', async () => {
        const error = new Error('Connection failed');
        mockGetDatabaseConnection.mockRejectedValue(error);

        const result = await handler({}, {});

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRoutes handler:', error);
        expect(mockGetRoutes).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(result.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Connection failed',
        });
    });

    it('handles getRoutes failure and returns 500', async () => {
        const error = new Error('Query failed');
        mockGetRoutes.mockRejectedValue(error);

        const result = await handler({}, {});

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRoutes handler:', error);
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Query failed',
        });
    });

    it('handles non-Error in catch and returns 500', async () => {
        mockGetRoutes.mockRejectedValue('string error');

        const result = await handler({}, {});

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'string error',
        });
    });
});
