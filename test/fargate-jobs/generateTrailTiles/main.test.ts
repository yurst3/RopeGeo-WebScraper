import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import getDatabaseConnection from '../../../src/helpers/getDatabaseConnection';
import putS3Object from '../../../src/helpers/s3/putS3Object';
import { getMapDataIds } from '../../../src/fargate-jobs/generateTrailTiles/database/getMapDataIds';
import { combineTrailGeojson } from '../../../src/fargate-jobs/generateTrailTiles/util/combineTrailGeojson';
import { makePmtiles } from '../../../src/fargate-jobs/generateTrailTiles/util/makePmtiles';
import { createCloudFrontInvalidation } from '../../../src/fargate-jobs/generateTrailTiles/cloudfront/createCloudFrontInvalidation';
import { main } from '../../../src/fargate-jobs/generateTrailTiles/main';

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/helpers/s3/putS3Object', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/database/getMapDataIds', () => ({ getMapDataIds: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/util/combineTrailGeojson', () => ({ combineTrailGeojson: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/util/makePmtiles', () => ({ makePmtiles: jest.fn() }));
jest.mock('fs', () => ({ readFileSync: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/cloudfront/createCloudFrontInvalidation', () => ({
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
        process.env = { ...originalEnv, MAP_DATA_BUCKET_NAME: 'test-map-data-bucket', CLOUDFRONT_DISTRIBUTION_ARN: '' };

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
        jest.mocked(combineTrailGeojson).mockResolvedValue(undefined);
        jest.mocked(makePmtiles).mockResolvedValue(undefined);
        jest.mocked(readFileSync).mockReturnValue(Buffer.from('fake-pmtiles-bytes'));
        jest.mocked(putS3Object).mockResolvedValue('https://bucket.s3.amazonaws.com/pmtiles/trails.pmtiles');
        jest.mocked(createCloudFrontInvalidation).mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws when MAP_DATA_BUCKET_NAME is not set (from getMapDataBucketName at start of try)', async () => {
        delete process.env.MAP_DATA_BUCKET_NAME;

        await expect(main()).rejects.toThrow('MAP_DATA_BUCKET_NAME is required');

        expect(getDatabaseConnection).not.toHaveBeenCalled();
        expect(getMapDataIds).not.toHaveBeenCalled();
        expect(combineTrailGeojson).not.toHaveBeenCalled();
        expect(putS3Object).not.toHaveBeenCalled();
    });

    it('throws when CLOUDFRONT_DISTRIBUTION_ARN is not set (from getCloudfrontDistributionArn at start of try)', async () => {
        delete process.env.CLOUDFRONT_DISTRIBUTION_ARN;

        await expect(main()).rejects.toThrow('CLOUDFRONT_DISTRIBUTION_ARN is required');

        expect(getDatabaseConnection).not.toHaveBeenCalled();
    });

    it('fetches MapData, combines GeoJSON, runs tippecanoe, uploads to S3', async () => {
        await main();

        expect(getDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(getMapDataIds).toHaveBeenCalledWith(expect.anything());
        expect(combineTrailGeojson).toHaveBeenCalledTimes(1);
        expect(combineTrailGeojson).toHaveBeenCalledWith(mockMapDataIds, '/tmp/trails.geojson', 'test-map-data-bucket');
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

        expect(combineTrailGeojson).toHaveBeenCalledWith([], '/tmp/trails.geojson', 'test-map-data-bucket');
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

    it('logs thrown error when getMapDataIds rejects', async () => {
        const dbError = new Error('DB connection failed');
        jest.mocked(getMapDataIds).mockRejectedValue(dbError);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('DB connection failed');

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(dbError);
        consoleErrorSpy.mockRestore();
    });

    it('logs thrown error when combineTrailGeojson rejects', async () => {
        const s3Error = new Error('S3 GetObject failed');
        jest.mocked(combineTrailGeojson).mockRejectedValue(s3Error);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('S3 GetObject failed');

        expect(consoleErrorSpy).toHaveBeenCalledWith(s3Error);
        consoleErrorSpy.mockRestore();
    });

    it('logs thrown error when makePmtiles rejects', async () => {
        const tippecanoeError = new Error('tippecanoe failed');
        jest.mocked(makePmtiles).mockRejectedValue(tippecanoeError);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('tippecanoe failed');

        expect(consoleErrorSpy).toHaveBeenCalledWith(tippecanoeError);
        consoleErrorSpy.mockRestore();
    });

    it('logs thrown error when putS3Object rejects', async () => {
        const uploadError = new Error('S3 PutObject failed');
        jest.mocked(putS3Object).mockRejectedValue(uploadError);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('S3 PutObject failed');

        expect(consoleErrorSpy).toHaveBeenCalledWith(uploadError);
        consoleErrorSpy.mockRestore();
    });

    it('propagates getS3Geojson rejection from inside combineTrailGeojson', async () => {
        jest.mocked(combineTrailGeojson).mockRejectedValue(new Error('S3 GetObject failed'));

        await expect(main()).rejects.toThrow('S3 GetObject failed');

        expect(combineTrailGeojson).toHaveBeenCalledWith(mockMapDataIds, '/tmp/trails.geojson', 'test-map-data-bucket');
    });

    it('propagates makePmtiles rejection', async () => {
        jest.mocked(makePmtiles).mockRejectedValue(new Error('tippecanoe failed'));

        await expect(main()).rejects.toThrow('tippecanoe failed');

        expect(putS3Object).not.toHaveBeenCalled();
    });
});
