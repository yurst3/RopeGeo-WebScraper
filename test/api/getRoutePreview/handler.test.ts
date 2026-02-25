import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import { handler } from '../../../src/api/getRoutePreview/handler';
import type { PagePreview } from '../../../src/types/pagePreview';
import { PageDataSource, RopewikiRoute } from '../../../src/types/pageRoute';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockRouteExists: jest.MockedFunction<typeof import('../../../src/api/getRoutePreview/database/routeExists').default>;
let mockGetPageRoutes: jest.MockedFunction<typeof import('../../../src/api/getRoutePreview/database/getPageRoutes').default>;
let mockGetRopewikiPagePreview: jest.MockedFunction<typeof import('../../../src/api/getRoutePreview/database/getRopewikiPagePreview').default>;

let mockClient: PoolClient;
let mockPool: { connect: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRoutePreview/database/routeExists', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRoutePreview/database/getPageRoutes', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRoutePreview/database/getRopewikiPagePreview', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('getRoutePreview handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() } as unknown as PoolClient;
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient as never),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockRouteExists = require('../../../src/api/getRoutePreview/database/routeExists').default;
        mockGetPageRoutes = require('../../../src/api/getRoutePreview/database/getPageRoutes').default;
        mockGetRopewikiPagePreview = require('../../../src/api/getRoutePreview/database/getRopewikiPagePreview').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockRouteExists.mockResolvedValue(true);
        mockGetPageRoutes.mockResolvedValue([]);
    });

    it('returns 400 when routeId is missing', async () => {
        const result = await handler({ pathParameters: {} }, {});

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Bad Request',
            error: 'Missing or empty path parameter: routeId',
        });
    });

    it('returns 400 when pathParameters is null', async () => {
        const result = await handler({ pathParameters: null } as never, {});

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });

    it('returns 400 when routeId is empty string', async () => {
        const result = await handler({ pathParameters: { routeId: '   ' } }, {});

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });

    it('returns 200 and array of page previews with CORS headers', async () => {
        const routeId = 'fc1abf41-5d4c-44d9-ac73-b0849f8255bb';
        const pageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const mockPreviews: PagePreview[] = [
            {
                id: pageId,
                source: PageDataSource.Ropewiki,
                imageUrl: 'https://example.com/banner.jpg',
                rating: 4.5,
                ratingCount: 12,
                title: 'Bear Creek Canyon',
                regions: ['Utah'],
                difficulty: { technical: '3', water: 'A', time: 'II', risk: null },
                mapData: null,
            },
        ];
        const ropewikiRoute = new RopewikiRoute(routeId, pageId);
        mockGetPageRoutes.mockResolvedValue([ropewikiRoute]);
        mockGetRopewikiPagePreview.mockResolvedValue(mockPreviews[0]!);

        const result = await handler({ pathParameters: { routeId } }, {});

        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockRouteExists).toHaveBeenCalledWith(mockClient, routeId);
        expect(mockGetPageRoutes).toHaveBeenCalledWith(mockClient, routeId);
        expect(mockGetRopewikiPagePreview).toHaveBeenCalledWith(mockClient, ropewikiRoute);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        expect(JSON.parse(result.body)).toEqual(mockPreviews);
    });

    it('returns 200 and empty array when no page routes exist for route', async () => {
        const routeId = 'fc1abf41-5d4c-44d9-ac73-b0849f8255bb';
        mockGetPageRoutes.mockResolvedValue([]);

        const result = await handler({ pathParameters: { routeId } }, {});

        expect(mockGetRopewikiPagePreview).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual([]);
    });

    it('returns 404 when no route exists with the given routeId', async () => {
        const routeId = 'fc1abf41-5d4c-44d9-ac73-b0849f8255bb';
        mockRouteExists.mockResolvedValue(false);

        const result = await handler({ pathParameters: { routeId } }, {});

        expect(mockRouteExists).toHaveBeenCalledWith(mockClient, routeId);
        expect(mockGetPageRoutes).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(404);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Not Found',
            error: 'No route found with the given routeId',
        });
    });

    it('handles getDatabaseConnection failure and returns 500', async () => {
        const error = new Error('Connection failed');
        mockGetDatabaseConnection.mockRejectedValue(error);

        const result = await handler(
            { pathParameters: { routeId: 'fc1abf41-5d4c-44d9-ac73-b0849f8255bb' } },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRoutePreview handler:', error);
        expect(mockGetPageRoutes).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Connection failed',
        });
    });

    it('handles getRopewikiPagePreview failure and returns 500', async () => {
        const routeId = 'fc1abf41-5d4c-44d9-ac73-b0849f8255bb';
        mockGetPageRoutes.mockResolvedValue([new RopewikiRoute(routeId, 'page-id')]);
        const error = new Error('Query failed');
        mockGetRopewikiPagePreview.mockRejectedValue(error);

        const result = await handler(
            { pathParameters: { routeId: 'fc1abf41-5d4c-44d9-ac73-b0849f8255bb' } },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRoutePreview handler:', error);
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Query failed',
        });
    });

    it('handles non-Error in catch and returns 500', async () => {
        mockGetPageRoutes.mockRejectedValue('string error');

        const result = await handler(
            { pathParameters: { routeId: 'fc1abf41-5d4c-44d9-ac73-b0849f8255bb' } },
            {},
        );

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'string error',
        });
    });
});
