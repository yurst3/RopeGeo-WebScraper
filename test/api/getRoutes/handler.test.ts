import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { handler } from '../../../src/api/getRoutes/handler';
import type * as s from 'zapatos/schema';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetRoutes: jest.MockedFunction<typeof import('../../../src/api/getRoutes/database/getRoutes').default>;

let mockClient: { release: ReturnType<typeof jest.fn> };
let mockPool: { connect: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRoutes/database/getRoutes', () => ({
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
        mockGetRoutes = require('../../../src/api/getRoutes/database/getRoutes').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetRoutes.mockResolvedValue([]);
    });

    it('returns 200 and JSON array of routes with CORS headers', async () => {
        const mockRows: s.Route.JSONSelectable[] = [
            {
                id: 'id-1',
                name: 'Route One',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
                deletedAt: null,
            } as s.Route.JSONSelectable,
        ];
        mockGetRoutes.mockResolvedValue(mockRows);

        const result = await handler({}, {});

        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockGetRoutes).toHaveBeenCalledWith(mockClient);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        expect(JSON.parse(result.body)).toEqual([
            { id: 'id-1', name: 'Route One', type: 'Canyon', coordinates: { lat: 40.1, lon: -111.5 } },
        ]);
    });

    it('returns 200 and empty array when no routes exist', async () => {
        mockGetRoutes.mockResolvedValue([]);

        const result = await handler({}, {});

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual([]);
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
