import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import {
    PageDataSource,
    RegionMiniMap,
    RopewikiRegionView,
    RoutesParams,
} from 'ropegeo-common/models';
import { handler } from '../../../src/api/getRopewikiRegionView/handler';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetRopewikiRegionView: jest.MockedFunction<typeof import('../../../src/api/getRopewikiRegionView/database/getRopewikiRegionView').default>;

let mockClient: PoolClient;
let mockPool: { connect: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRopewikiRegionView/database/getRopewikiRegionView', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('getRopewikiRegionView handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() } as unknown as PoolClient;
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient as never),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockGetRopewikiRegionView = require('../../../src/api/getRopewikiRegionView/database/getRopewikiRegionView').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetRopewikiRegionView.mockResolvedValue(null);
    });

    it('returns 400 when id is missing', async () => {
        const result = await handler({ pathParameters: {} }, {});

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Bad Request',
            error: 'Missing or empty path parameter: id',
        });
    });

    it('returns 400 when id is empty string', async () => {
        const result = await handler({ pathParameters: { id: '   ' } }, {});

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });

    it('returns 400 when id is not a valid UUID', async () => {
        const result = await handler(
            { pathParameters: { id: 'not-a-uuid' } },
            {},
        );

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(mockGetRopewikiRegionView).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Bad Request',
            error: 'Path parameter id must be a valid UUID',
        });
    });

    it('returns 200 and RopewikiRegionView with CORS headers', async () => {
        const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const miniMap = new RegionMiniMap(
            new RoutesParams({
                region: { id, source: PageDataSource.Ropewiki },
            }),
        );
        const mockView = new RopewikiRegionView(
            'North America',
            new Date('2025-01-15T00:00:00.000Z'),
            'https://ropewiki.com/North_America',
            new Date('2025-01-10T08:00:00.000Z'),
            miniMap,
            [{ id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012', name: 'World' }],
            120,
            45,
            12,
            380,
            'Canyoneering regions.',
            ['April', 'May'],
            true,
        );
        mockGetRopewikiRegionView.mockResolvedValue(mockView);

        const result = await handler({ pathParameters: { id } }, {});

        expect(mockGetRopewikiRegionView).toHaveBeenCalledWith(mockClient, id);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        const body = JSON.parse(result.body);
        expect(body.resultType).toBe('ropewikiRegionView');
        expect(body.result).toBeDefined();
        expect(body.result.name).toBe('North America');
        expect(body.result.externalLink).toBe('https://ropewiki.com/North_America');
        expect(body.result.regions).toEqual([{ id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012', name: 'World' }]);
        expect(body.result.regionCount).toBe(12);
        expect(body.result.topLevelPageCount).toBe(45);
        expect(body.result.pageCount).toBe(120);
        expect(body.result.totalPageCount).toBe(380);
        expect(body.result.syncDate).toBe('2025-01-10T08:00:00.000Z');
        expect(body.result.miniMap).toMatchObject({
            miniMapType: 'geojson',
            routesParams: {
                region: { id, source: 'ropewiki' },
            },
        });
        expect(body.result.overview).toEqual({
            order: 1,
            title: 'Overview',
            text: 'Canyoneering regions.',
            images: [],
            latestRevisionDate: '2025-01-15T00:00:00.000Z',
        });
    });

    it('returns 200 with null overview when region has no overview', async () => {
        const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const miniMap = new RegionMiniMap(
            new RoutesParams({
                region: { id, source: PageDataSource.Ropewiki },
            }),
        );
        const mockView = new RopewikiRegionView(
            'North America',
            new Date('2025-01-15T00:00:00.000Z'),
            'https://ropewiki.com/North_America',
            new Date('2025-01-10T08:00:00.000Z'),
            miniMap,
            [{ id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012', name: 'World' }],
            120,
            45,
            12,
            380,
            null,
            ['April', 'May'],
            true,
        );
        mockGetRopewikiRegionView.mockResolvedValue(mockView);

        const result = await handler({ pathParameters: { id } }, {});

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.resultType).toBe('ropewikiRegionView');
        expect(body.result.overview).toBeNull();
    });

    it('returns 404 when no region exists with the given id', async () => {
        const regionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        mockGetRopewikiRegionView.mockResolvedValue(null);

        const result = await handler({ pathParameters: { id: regionId } }, {});

        expect(mockGetRopewikiRegionView).toHaveBeenCalledWith(mockClient, regionId);
        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Not Found',
            error: 'No Ropewiki region found with the given id',
        });
    });

    it('handles getDatabaseConnection failure and returns 500', async () => {
        const error = new Error('Connection failed');
        mockGetDatabaseConnection.mockRejectedValue(error);

        const result = await handler(
            { pathParameters: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRopewikiRegionView handler:', error);
        expect(mockGetRopewikiRegionView).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Connection failed',
        });
    });

    it('handles getRopewikiRegionView failure and returns 500', async () => {
        const error = new Error('Query failed');
        mockGetRopewikiRegionView.mockRejectedValue(error);

        const result = await handler(
            { pathParameters: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRopewikiRegionView handler:', error);
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Query failed',
        });
    });
});
