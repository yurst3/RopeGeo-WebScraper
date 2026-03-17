import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import { handler } from '../../../src/api/getRopewikiPageView/handler';
import type { RopewikiPageView } from 'ropegeo-common';
import { Bounds, PermitStatus } from 'ropegeo-common';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetRopewikiPageView: jest.MockedFunction<typeof import('../../../src/api/getRopewikiPageView/database/getRopewikiPageView').default>;

let mockClient: PoolClient;
let mockPool: { connect: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRopewikiPageView/database/getRopewikiPageView', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('getRopewikiPageView handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() } as unknown as PoolClient;
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient as never),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockGetRopewikiPageView = require('../../../src/api/getRopewikiPageView/database/getRopewikiPageView').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetRopewikiPageView.mockResolvedValue(null);
    });

    it('returns 400 when id is missing', async () => {
        const result = await handler({ pathParameters: {} }, {});

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Bad Request',
            error: 'Missing or empty path parameter: id',
        });
    });

    it('returns 400 when pathParameters is null', async () => {
        const result = await handler({ pathParameters: null } as never, {});

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });

    it('returns 400 when id is empty string', async () => {
        const result = await handler({ pathParameters: { id: '   ' } }, {});

        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });

    it('returns 200 and RopewikiPageView with CORS headers', async () => {
        const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const mockView: RopewikiPageView = {
            pageId: 'Bear_Creek_Canyon',
            name: 'Bear Creek Canyon',
            aka: [],
            url: 'https://ropewiki.com/Bear_Creek_Canyon',
            quality: 4.5,
            userVotes: 12,
            difficulty: { technical: '3', water: 'A', time: 'II', risk: null },
            permit: PermitStatus.No,
            rappelCount: { min: 5, max: 5 },
            jumps: null,
            vehicle: '',
            rappelLongest: 195,
            shuttleTime: 0,
            overallTime: { min: 3.75, max: 4.9 },
            overallLength: null,
            approachTime: null,
            descentTime: null,
            exitTime: null,
            approachElevGain: null,
            exitElevGain: null,
            months: ['Jun', 'Jul'],
            latestRevisionDate: new Date('2025-01-01T00:00:00.000Z'),
            regions: [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Utah' }],
            bannerImage: null,
            betaSections: [],
            tilesTemplate: null,
            bounds: null,
        };
        mockGetRopewikiPageView.mockResolvedValue(mockView);

        const result = await handler({ pathParameters: { id } }, {});

        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiPageView).toHaveBeenCalledWith(mockClient, id);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        const body = JSON.parse(result.body);
        expect(body.resultType).toBe('ropewikiPageView');
        expect(body.result).toBeDefined();
        expect(body.result.pageId).toBe('Bear_Creek_Canyon');
        expect(body.result.name).toBe('Bear Creek Canyon');
        expect(body.result.permit).toBe('No');
        expect(body.result.tilesTemplate).toBeNull();
        expect(body.result.bounds).toBeNull();
    });

    it('returns 200 with tilesTemplate when view has map tiles', async () => {
        const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const template =
            'https://api.webscraper.ropegeo.com/mapdata/tiles/38f5c3fa-7248-41ed-815e-8b9e6aae5d61/{z}/{x}/{y}.pbf';
        const mockView: RopewikiPageView = {
            pageId: 'Bear_Creek_Canyon',
            name: 'Bear Creek Canyon',
            aka: [],
            url: 'https://ropewiki.com/Bear_Creek_Canyon',
            quality: 4.5,
            userVotes: 12,
            difficulty: { technical: '3', water: 'A', time: 'II', risk: null },
            permit: PermitStatus.No,
            rappelCount: { min: 5, max: 5 },
            jumps: null,
            vehicle: '',
            rappelLongest: 195,
            shuttleTime: 0,
            overallTime: { min: 3.75, max: 4.9 },
            overallLength: null,
            approachTime: null,
            descentTime: null,
            exitTime: null,
            approachElevGain: null,
            exitElevGain: null,
            months: ['Jun', 'Jul'],
            latestRevisionDate: new Date('2025-01-01T00:00:00.000Z'),
            regions: [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Utah' }],
            bannerImage: null,
            betaSections: [],
            tilesTemplate: template,
            bounds: null,
        };
        mockGetRopewikiPageView.mockResolvedValue(mockView);

        const result = await handler({ pathParameters: { id } }, {});

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.result.tilesTemplate).toBe(template);
    });

    it('returns 200 with bounds when view has bounds', async () => {
        const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const bounds = { north: 39.5, south: 38.1, east: -108.2, west: -110.0 };
        const tilesTemplate =
            'https://api.webscraper.ropegeo.com/mapdata/tiles/38f5c3fa-7248-41ed-815e-8b9e6aae5d61/{z}/{x}/{y}.pbf';
        const mockView: RopewikiPageView = {
            pageId: 'Bear_Creek_Canyon',
            name: 'Bear Creek Canyon',
            aka: [],
            url: 'https://ropewiki.com/Bear_Creek_Canyon',
            quality: 4.5,
            userVotes: 12,
            difficulty: { technical: '3', water: 'A', time: 'II', risk: null },
            permit: PermitStatus.No,
            rappelCount: { min: 5, max: 5 },
            jumps: null,
            vehicle: '',
            rappelLongest: 195,
            shuttleTime: 0,
            overallTime: { min: 3.75, max: 4.9 },
            overallLength: null,
            approachTime: null,
            descentTime: null,
            exitTime: null,
            approachElevGain: null,
            exitElevGain: null,
            months: ['Jun', 'Jul'],
            latestRevisionDate: new Date('2025-01-01T00:00:00.000Z'),
            regions: [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Utah' }],
            bannerImage: null,
            betaSections: [],
            tilesTemplate,
            bounds: new Bounds(39.5, 38.1, -108.2, -110.0),
        };
        mockGetRopewikiPageView.mockResolvedValue(mockView);

        const result = await handler({ pathParameters: { id } }, {});

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.result.bounds).toEqual({
            north: 39.5,
            south: 38.1,
            east: -108.2,
            west: -110.0,
        });
    });

    it('returns 404 when no page exists with the given id', async () => {
        const pageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        mockGetRopewikiPageView.mockResolvedValue(null);

        const result = await handler({ pathParameters: { id: pageId } }, {});

        expect(mockGetRopewikiPageView).toHaveBeenCalledWith(mockClient, pageId);
        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Not Found',
            error: 'No Ropewiki page found with the given id',
        });
    });

    it('handles getDatabaseConnection failure and returns 500', async () => {
        const error = new Error('Connection failed');
        mockGetDatabaseConnection.mockRejectedValue(error);

        const result = await handler(
            { pathParameters: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRopewikiPageView handler:', error);
        expect(mockGetRopewikiPageView).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Connection failed',
        });
    });

    it('handles getRopewikiPageView failure and returns 500', async () => {
        const error = new Error('Query failed');
        mockGetRopewikiPageView.mockRejectedValue(error);

        const result = await handler(
            { pathParameters: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getRopewikiPageView handler:', error);
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'Query failed',
        });
    });

    it('handles non-Error in catch and returns 500', async () => {
        mockGetRopewikiPageView.mockRejectedValue('string error');

        const result = await handler(
            { pathParameters: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            {},
        );

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toMatchObject({
            message: 'Internal server error',
            error: 'string error',
        });
    });
});
