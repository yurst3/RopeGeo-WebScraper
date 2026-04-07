import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PaginationResultType } from 'ropegeo-common/models';
import { handler } from '../../../src/api/getMapdataTiles/handler';

let mockGetTiles: jest.MockedFunction<
    typeof import('../../../src/api/getMapdataTiles/util/getTilesAndTotalBytes').default
>;

jest.mock('../../../src/api/getMapdataTiles/util/getTilesAndTotalBytes', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('getMapdataTiles handler', () => {
    const validMapDataId = '550e8400-e29b-41d4-a716-446655440000';
    const tileUrl0 = `https://test-map-bucket.s3.amazonaws.com/tiles/${validMapDataId}/0/0/0.pbf`;
    const tileUrl1 = `https://test-map-bucket.s3.amazonaws.com/tiles/${validMapDataId}/0/0/1.pbf`;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.MAP_DATA_BUCKET_NAME = 'test-map-bucket';
        delete process.env.MAP_DATA_PUBLIC_BASE_URL;
        mockGetTiles = require('../../../src/api/getMapdataTiles/util/getTilesAndTotalBytes')
            .default as typeof mockGetTiles;
        mockGetTiles.mockResolvedValue({
            results: [tileUrl0, tileUrl1],
            totalBytes: 2048,
        });
    });

    it('returns 400 when mapDataId is missing', async () => {
        const result = await handler({ pathParameters: {} }, {});
        expect(result.statusCode).toBe(400);
        expect(mockGetTiles).not.toHaveBeenCalled();
    });

    it('returns 400 when mapDataId is not a UUID', async () => {
        const result = await handler({ pathParameters: { mapDataId: 'not-a-uuid' } }, {});
        expect(result.statusCode).toBe(400);
        expect(mockGetTiles).not.toHaveBeenCalled();
    });

    it('returns 400 when page is invalid', async () => {
        const result = await handler(
            {
                pathParameters: { mapDataId: validMapDataId },
                queryStringParameters: { page: '0' },
            },
            {},
        );
        expect(result.statusCode).toBe(400);
    });

    it('returns 400 when limit exceeds maximum', async () => {
        const result = await handler(
            {
                pathParameters: { mapDataId: validMapDataId },
                queryStringParameters: { limit: '5001' },
            },
            {},
        );
        expect(result.statusCode).toBe(400);
    });

    it('returns 500 when getTilesAndTotalBytes rejects with missing bucket', async () => {
        mockGetTiles.mockRejectedValueOnce(
            new Error('MAP_DATA_BUCKET_NAME environment variable is not set'),
        );
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const result = await handler({ pathParameters: { mapDataId: validMapDataId } }, {});
        expect(result.statusCode).toBe(500);
        expect(mockGetTiles).toHaveBeenCalledWith(validMapDataId);
        consoleSpy.mockRestore();
    });

    it('returns 200 with paginated tile URLs and totalBytes', async () => {
        const result = await handler(
            {
                pathParameters: { mapDataId: validMapDataId },
                queryStringParameters: { page: '1', limit: '1' },
            },
            {},
        );
        expect(result.statusCode).toBe(200);
        expect(mockGetTiles).toHaveBeenCalledWith(validMapDataId);
        const body = JSON.parse(result.body);
        expect(body.resultType).toBe(PaginationResultType.MapDataTileKeys);
        expect(body.total).toBe(2);
        expect(body.totalBytes).toBe(2048);
        expect(body.page).toBe(1);
        expect(body.results).toHaveLength(1);
        expect(body.results[0]).toBe(tileUrl0);
    });

    it('returns second page when page is 2', async () => {
        const result = await handler(
            {
                pathParameters: { mapDataId: validMapDataId },
                queryStringParameters: { page: '2', limit: '1' },
            },
            {},
        );
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.results).toHaveLength(1);
        expect(body.results[0]).toBe(tileUrl1);
    });

    it('returns 500 when getTilesAndTotalBytes rejects', async () => {
        mockGetTiles.mockRejectedValueOnce(new Error('S3 unavailable'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const result = await handler({ pathParameters: { mapDataId: validMapDataId } }, {});
        expect(result.statusCode).toBe(500);
        consoleSpy.mockRestore();
    });
});
