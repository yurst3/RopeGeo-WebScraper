import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import { RopewikiRegionImagesResult } from 'ropegeo-common/classes';
import { handler } from '../../../src/api/getRopewikiRegionImages/handler';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetAllowedRegionIds: jest.MockedFunction<typeof import('../../../src/ropewiki/database/getAllowedRegionIds').default>;
let mockGetRopewikiRegionImages: jest.MockedFunction<typeof import('../../../src/api/getRopewikiRegionImages/util/getRopewikiRegionImages').default>;

let mockClient: PoolClient;
let mockPool: { connect: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/ropewiki/database/getAllowedRegionIds', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRopewikiRegionImages/util/getRopewikiRegionImages', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('getRopewikiRegionImages handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() } as unknown as PoolClient;
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient as never),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockGetAllowedRegionIds = require('../../../src/ropewiki/database/getAllowedRegionIds').default;
        mockGetRopewikiRegionImages = require('../../../src/api/getRopewikiRegionImages/util/getRopewikiRegionImages').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetAllowedRegionIds.mockResolvedValue(['a1b2c3d4-e5f6-7890-abcd-ef1234567890']);
        mockGetRopewikiRegionImages.mockResolvedValue(new RopewikiRegionImagesResult([], null));
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
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Bad Request',
            error: 'Path parameter id must be a valid UUID',
        });
    });

    it('returns 400 when query params are invalid', async () => {
        const result = await handler(
            {
                pathParameters: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
                queryStringParameters: { limit: 'invalid' },
            },
            {},
        );

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });

    it('returns 200 and RopewikiRegionImagesResult with CORS headers', async () => {
        const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const mockResult = new RopewikiRegionImagesResult([], null);
        mockGetRopewikiRegionImages.mockResolvedValue(mockResult);

        const result = await handler(
            { pathParameters: { id }, queryStringParameters: {} },
            {},
        );

        expect(mockGetAllowedRegionIds).toHaveBeenCalledWith(mockClient, id);
        expect(mockGetRopewikiRegionImages).toHaveBeenCalled();
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        const body = JSON.parse(result.body);
        expect(body).toHaveProperty('results');
        expect(body).toHaveProperty('nextCursor');
        expect(body.results).toEqual([]);
        expect(body.nextCursor).toBeNull();
    });

    it('returns 404 when no region exists with the given id', async () => {
        const regionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        mockGetAllowedRegionIds.mockResolvedValue([]);

        const result = await handler(
            { pathParameters: { id: regionId }, queryStringParameters: {} },
            {},
        );

        expect(mockGetAllowedRegionIds).toHaveBeenCalledWith(mockClient, regionId);
        expect(mockGetRopewikiRegionImages).not.toHaveBeenCalled();
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
            {
                pathParameters: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
                queryStringParameters: {},
            },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRopewikiRegionImages handler:', error);
        expect(mockGetRopewikiRegionImages).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Connection failed',
        });
    });

    it('handles getRopewikiRegionImages failure and returns 500', async () => {
        const error = new Error('Query failed');
        mockGetRopewikiRegionImages.mockRejectedValue(error);

        const result = await handler(
            {
                pathParameters: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
                queryStringParameters: {},
            },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRopewikiRegionImages handler:', error);
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Query failed',
        });
    });
});
