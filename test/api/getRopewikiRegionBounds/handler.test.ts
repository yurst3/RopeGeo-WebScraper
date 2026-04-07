import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Bounds } from 'ropegeo-common/models';
import { handler } from '../../../src/api/getRopewikiRegionBounds/handler';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetRopewikiRegionRouteBounds: jest.MockedFunction<
    typeof import('../../../src/api/getRopewikiRegionBounds/database/getRopewikiRegionRouteBounds').default
>;

let mockClient: { release: ReturnType<typeof jest.fn> };
let mockPool: { connect: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRopewikiRegionBounds/database/getRopewikiRegionRouteBounds', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('getRopewikiRegionBounds handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockGetRopewikiRegionRouteBounds = require('../../../src/api/getRopewikiRegionBounds/database/getRopewikiRegionRouteBounds').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetRopewikiRegionRouteBounds.mockResolvedValue(null);
    });

    it('returns 400 when id is missing', async () => {
        const result = await handler({ pathParameters: {} }, {});

        expect(result.statusCode).toBe(400);
        expect(mockGetRopewikiRegionRouteBounds).not.toHaveBeenCalled();
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Bad Request');
        expect(body.error).toMatch(/id/i);
    });

    it('returns 400 when id is not a valid UUID', async () => {
        const result = await handler({ pathParameters: { id: 'not-a-uuid' } }, {});

        expect(result.statusCode).toBe(400);
        expect(mockGetRopewikiRegionRouteBounds).not.toHaveBeenCalled();
    });

    it('returns 404 when no bounds exist', async () => {
        mockGetRopewikiRegionRouteBounds.mockResolvedValue(null);

        const result = await handler({ pathParameters: { id: validUuid } }, {});

        expect(mockGetRopewikiRegionRouteBounds).toHaveBeenCalledWith(mockClient, validUuid);
        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body).message).toBe('Not Found');
    });

    it('returns 200 and RopewikiRegionBoundsResult when bounds exist', async () => {
        const bounds = new Bounds(40.5, 40.1, -111.2, -111.8);
        mockGetRopewikiRegionRouteBounds.mockResolvedValue(bounds);

        const result = await handler({ pathParameters: { id: validUuid } }, {});

        expect(result.statusCode).toBe(200);
        expect(result.headers['Content-Type']).toBe('application/json');
        const body = JSON.parse(result.body);
        expect(body.resultType).toBe('ropewikiRegionBounds');
        expect(body.result).toEqual({
            north: 40.5,
            south: 40.1,
            east: -111.2,
            west: -111.8,
        });
        expect(mockClient.release).toHaveBeenCalled();
    });

    it('trims path id', async () => {
        mockGetRopewikiRegionRouteBounds.mockResolvedValue(null);

        await handler({ pathParameters: { id: `  ${validUuid}  ` } }, {});

        expect(mockGetRopewikiRegionRouteBounds).toHaveBeenCalledWith(mockClient, validUuid);
    });

    it('returns 500 on database failure', async () => {
        const err = new Error('db down');
        mockGetDatabaseConnection.mockRejectedValue(err);

        const result = await handler({ pathParameters: { id: validUuid } }, {});

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).message).toBe('Internal server error');
    });
});
