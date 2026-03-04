import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { handler } from '../../../src/api/search/handler';

let mockGetDatabaseConnection: jest.MockedFunction<
    typeof import('../../../src/helpers/getDatabaseConnection').default
>;
let mockSearchRopewiki: jest.MockedFunction<
    typeof import('../../../src/api/search/util/searchRopewiki').default
>;

let mockClient: { release: ReturnType<typeof jest.fn> };
let mockPool: { connect: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/search/util/searchRopewiki', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('search handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
        };

        mockGetDatabaseConnection =
            require('../../../src/helpers/getDatabaseConnection').default;
        mockSearchRopewiki =
            require('../../../src/api/search/util/searchRopewiki').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockSearchRopewiki.mockResolvedValue({ results: [], nextCursor: '' });
    });

    it('returns 400 when name is missing', async () => {
        const result = await handler({ queryStringParameters: {} }, {});

        expect(mockSearchRopewiki).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain('name');
    });

    it('returns 400 when name is empty string', async () => {
        const result = await handler(
            { queryStringParameters: { name: '   ' } },
            {},
        );

        expect(mockSearchRopewiki).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });

    it('returns 400 when similarity is invalid', async () => {
        const result = await handler(
            {
                queryStringParameters: {
                    name: 'Imlay',
                    similarity: '1.5',
                },
            },
            {},
        );

        expect(mockSearchRopewiki).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain('similarity');
    });

    it('returns 400 when order is invalid', async () => {
        const result = await handler(
            {
                queryStringParameters: {
                    name: 'Imlay',
                    order: 'popularity',
                },
            },
            {},
        );

        expect(mockSearchRopewiki).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain('order');
    });

    it('returns 400 when both include-pages and include-regions are false', async () => {
        const result = await handler(
            {
                queryStringParameters: {
                    name: 'Imlay',
                    'include-pages': 'false',
                    'include-regions': 'false',
                },
            },
            {},
        );

        expect(mockSearchRopewiki).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });

    it('returns 200 and SearchResults with default params', async () => {
        const mockResults = [
            {
                id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                source: 'ropewiki',
                imageUrl: null,
                rating: 0.95,
                ratingCount: 42,
                title: 'Imlay Canyon',
                regions: ['Utah'],
                difficulty: { technical: '3', water: 'B', time: 'III', risk: null },
                mapData: null,
                externalLink: 'https://ropewiki.com/Imlay_Canyon',
                permit: null,
            },
        ];
        mockSearchRopewiki.mockResolvedValue({
            results: mockResults,
            nextCursor: '',
        });

        const result = await handler(
            {
                queryStringParameters: { name: 'Imlay' },
            },
            {},
        );

        expect(mockSearchRopewiki).toHaveBeenCalledWith(mockClient, {
            name: 'Imlay',
            similarityThreshold: 0.5,
            includePages: true,
            includeRegions: true,
            regionId: null,
            order: 'similarity',
            limit: 20,
            cursor: null,
        });
        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        expect(JSON.parse(result.body)).toEqual({
            results: mockResults,
            nextCursor: '',
        });
    });

    it('returns 400 when queryStringParameters is null', async () => {
        const result = await handler({ queryStringParameters: null }, {});

        expect(mockSearchRopewiki).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe('Missing query string parameters');
    });

    it('returns 400 when queryStringParameters is undefined', async () => {
        const result = await handler({}, {});

        expect(mockSearchRopewiki).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toBe('Missing query string parameters');
    });

    it('passes optional params including limit and cursor to searchRopewiki', async () => {
        await handler(
            {
                queryStringParameters: {
                    name: 'Imlay',
                    similarity: '0.3',
                    'include-pages': 'true',
                    'include-regions': 'false',
                    region: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                    order: 'quality',
                    limit: '10',
                    cursor: 'eyJzb3J0S2V5IjowLjksInR5cGUiOiJwYWdlIiwiaWQiOiJhMTIzIn0',
                },
            },
            {},
        );

        expect(mockSearchRopewiki).toHaveBeenCalledWith(mockClient, {
            name: 'Imlay',
            similarityThreshold: 0.3,
            includePages: true,
            includeRegions: false,
            regionId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            order: 'quality',
            limit: 10,
            cursor: expect.objectContaining({
                sortKey: expect.any(Number),
                type: 'page',
                id: 'a123',
            }),
        });
    });

    it('returns 400 when cursor is invalid', async () => {
        const result = await handler(
            {
                queryStringParameters: {
                    name: 'Imlay',
                    cursor: 'not-valid-base64!!!',
                },
            },
            {},
        );

        expect(mockSearchRopewiki).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toContain('cursor');
    });

    it('handles getDatabaseConnection failure and returns 500', async () => {
        const error = new Error('Connection failed');
        mockGetDatabaseConnection.mockRejectedValue(error);

        const result = await handler(
            { queryStringParameters: { name: 'Imlay' } },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Error in search handler:',
            error,
        );
        expect(mockSearchRopewiki).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toBe('Connection failed');
    });

    it('handles searchRopewiki failure and returns 500', async () => {
        const error = new Error('Query failed');
        mockSearchRopewiki.mockRejectedValue(error);

        const result = await handler(
            { queryStringParameters: { name: 'Imlay' } },
            {},
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Error in search handler:',
            error,
        );
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toBe('Query failed');
    });
});
