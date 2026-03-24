import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import getTilesAndTotalBytes from '../../../../src/api/getMapdataTiles/util/getTilesAndTotalBytes';
import listAllPbfKeysAndTotalBytes from '../../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes';

jest.mock('../../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('getTilesAndTotalBytes', () => {
    const mapDataId = '550e8400-e29b-41d4-a716-446655440000';
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv, MAP_DATA_BUCKET_NAME: 'test-map-bucket' };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('maps S3 keys to S3-style public URLs when MAP_DATA_PUBLIC_BASE_URL is unset', async () => {
        delete process.env.MAP_DATA_PUBLIC_BASE_URL;
        jest.mocked(listAllPbfKeysAndTotalBytes).mockResolvedValue({
            keys: [`tiles/${mapDataId}/0/0/0.pbf`],
            totalBytes: 512,
        });

        const { results, totalBytes } = await getTilesAndTotalBytes(mapDataId);

        expect(totalBytes).toBe(512);
        expect(results).toEqual([
            `https://test-map-bucket.s3.amazonaws.com/tiles/${mapDataId}/0/0/0.pbf`,
        ]);
    });

    it('maps S3 keys to CloudFront-style URLs when MAP_DATA_PUBLIC_BASE_URL is set', async () => {
        process.env.MAP_DATA_PUBLIC_BASE_URL = 'https://api.webscraper.ropegeo.com';
        jest.mocked(listAllPbfKeysAndTotalBytes).mockResolvedValue({
            keys: [`tiles/${mapDataId}/1/2/3.pbf`],
            totalBytes: 1024,
        });

        const { results, totalBytes } = await getTilesAndTotalBytes(mapDataId);

        expect(totalBytes).toBe(1024);
        expect(results).toEqual([
            'https://api.webscraper.ropegeo.com/mapdata/tiles/550e8400-e29b-41d4-a716-446655440000/1/2/3.pbf',
        ]);
    });

    it('propagates errors from listAllPbfKeysAndTotalBytes', async () => {
        jest.mocked(listAllPbfKeysAndTotalBytes).mockRejectedValue(new Error('S3 unavailable'));

        await expect(getTilesAndTotalBytes(mapDataId)).rejects.toThrow('S3 unavailable');
    });
});
