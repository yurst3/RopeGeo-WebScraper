import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import getDatabaseConnection from '../../../src/helpers/getDatabaseConnection';
import getS3Object from '../../../src/helpers/s3/getS3Object';
import putS3Object from '../../../src/helpers/s3/putS3Object';
import { getMapDataIds } from '../../../src/fargate-jobs/generateTrailTiles/database/getMapDataIds';
import { combineTrailGeojson } from '../../../src/fargate-jobs/generateTrailTiles/util/combineTrailGeojson';
import { makePmtiles } from '../../../src/fargate-jobs/generateTrailTiles/util/makePmtiles';
import { createCloudFrontInvalidation } from '../../../src/fargate-jobs/generateTrailTiles/util/createCloudFrontInvalidation';
import { main } from '../../../src/fargate-jobs/generateTrailTiles/main';

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/helpers/s3/getS3Object', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/helpers/s3/putS3Object', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/database/getMapDataIds', () => ({ getMapDataIds: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/util/combineTrailGeojson', () => ({ combineTrailGeojson: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/util/makePmtiles', () => ({ makePmtiles: jest.fn() }));
jest.mock('fs', () => ({ readFileSync: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/util/createCloudFrontInvalidation', () => ({
    createCloudFrontInvalidation: jest.fn(),
}));

describe('main (generateTrailTiles)', () => {
    const mockMapDataIds = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
    let originalEnv: NodeJS.ProcessEnv;
    let mockRelease: ReturnType<typeof jest.fn>;
    let mockPoolEnd: ReturnType<typeof jest.fn>;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv, MAP_DATA_BUCKET_NAME: 'test-map-data-bucket' };
        delete process.env.CLOUDFRONT_DISTRIBUTION_ARN;

        mockRelease = jest.fn();
        mockPoolEnd = jest.fn();
        const mockPool = {
            connect: jest.fn(),
            end: mockPoolEnd,
        };
        // @ts-expect-error - mock pool client shape for test
        (mockPool.connect as jest.Mock).mockResolvedValue({ release: mockRelease });
        jest.mocked(getDatabaseConnection).mockResolvedValue(mockPool as unknown as Awaited<ReturnType<typeof getDatabaseConnection>>);
        jest.mocked(getMapDataIds).mockResolvedValue(mockMapDataIds);
        jest.mocked(getS3Object).mockResolvedValue({ body: JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} }] }) });
        jest.mocked(combineTrailGeojson).mockImplementation(() => {});
        jest.mocked(makePmtiles).mockResolvedValue(undefined);
        jest.mocked(readFileSync).mockReturnValue(Buffer.from('fake-pmtiles-bytes'));
        jest.mocked(putS3Object).mockResolvedValue('https://bucket.s3.amazonaws.com/pmtiles/trails.pmtiles');
        jest.mocked(createCloudFrontInvalidation).mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws when MAP_DATA_BUCKET_NAME is not set', async () => {
        delete process.env.MAP_DATA_BUCKET_NAME;

        await expect(main()).rejects.toThrow('MAP_DATA_BUCKET_NAME is required');

        expect(getDatabaseConnection).not.toHaveBeenCalled();
    });

    it('fetches MapData, combines GeoJSON, runs tippecanoe, uploads to S3', async () => {
        await main();

        expect(getDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(getMapDataIds).toHaveBeenCalledWith(expect.anything());
        expect(getS3Object).toHaveBeenCalledWith('test-map-data-bucket', 'geojson/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.geojson');
        expect(combineTrailGeojson).toHaveBeenCalledTimes(1);
        expect(combineTrailGeojson).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    geojsonBody: expect.any(String),
                }),
            ]),
            '/tmp/trails.geojson'
        );
        expect(makePmtiles).toHaveBeenCalledWith('/tmp/trails.geojson', '/tmp/trails.pmtiles');
        expect(readFileSync).toHaveBeenCalledWith('/tmp/trails.pmtiles');
        expect(putS3Object).toHaveBeenCalledWith(
            'test-map-data-bucket',
            'pmtiles/trails.pmtiles',
            expect.any(Buffer),
            'application/vnd.pmtiles'
        );
        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(createCloudFrontInvalidation).not.toHaveBeenCalled();
    });

    it('handles empty MapData rows and still writes GeoJSON and uploads', async () => {
        jest.mocked(getMapDataIds).mockResolvedValue([]);

        await main();

        expect(getS3Object).not.toHaveBeenCalled();
        expect(combineTrailGeojson).toHaveBeenCalledWith([], '/tmp/trails.geojson');
        expect(makePmtiles).toHaveBeenCalled();
        expect(putS3Object).toHaveBeenCalled();
    });

    it('calls createCloudFrontInvalidation when CLOUDFRONT_DISTRIBUTION_ARN is set', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = 'arn:aws:cloudfront::123456789012:distribution/E2ABC123';

        await main();

        expect(createCloudFrontInvalidation).toHaveBeenCalledTimes(1);
        expect(createCloudFrontInvalidation).toHaveBeenCalledWith(
            'arn:aws:cloudfront::123456789012:distribution/E2ABC123'
        );
    });

    it('releases client and ends pool when getMapDataIds throws', async () => {
        jest.mocked(getMapDataIds).mockRejectedValue(new Error('DB error'));

        await expect(main()).rejects.toThrow('DB error');

        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(combineTrailGeojson).not.toHaveBeenCalled();
        expect(makePmtiles).not.toHaveBeenCalled();
    });

    it('propagates getS3Object rejection', async () => {
        jest.mocked(getS3Object).mockRejectedValue(new Error('S3 GetObject failed'));

        await expect(main()).rejects.toThrow('S3 GetObject failed');

        expect(combineTrailGeojson).not.toHaveBeenCalled();
    });

    it('propagates makePmtiles rejection', async () => {
        jest.mocked(makePmtiles).mockRejectedValue(new Error('tippecanoe failed'));

        await expect(main()).rejects.toThrow('tippecanoe failed');

        expect(putS3Object).not.toHaveBeenCalled();
    });
});
