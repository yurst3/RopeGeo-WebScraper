import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import getDatabaseConnection from '../../../src/helpers/getDatabaseConnection';
import { getMapDataIds } from '../../../src/fargate-jobs/generateTrailTiles/database/getMapDataIds';
import { processGeojsons } from '../../../src/fargate-jobs/generateTrailTiles/processors/processGeojsons';
import { makeTiles } from '../../../src/fargate-jobs/generateTrailTiles/util/makeTiles';
import { uploadTilesToS3 } from '../../../src/fargate-jobs/generateTrailTiles/s3/uploadTilesToS3';
import { invalidateCloudFrontCache } from '../../../src/fargate-jobs/generateTrailTiles/cloudfront/invalidateCloudFrontCache';
import { main } from '../../../src/fargate-jobs/generateTrailTiles/main';

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/database/getMapDataIds', () => ({ getMapDataIds: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/processors/processGeojsons', () => ({ processGeojsons: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/util/makeTiles', () => ({ makeTiles: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/s3/uploadTilesToS3', () => ({ uploadTilesToS3: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateTrailTiles/cloudfront/invalidateCloudFrontCache', () => ({
    invalidateCloudFrontCache: jest.fn(),
}));

describe('main (generateTrailTiles)', () => {
    const mockMapDataIds = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
    let originalEnv: NodeJS.ProcessEnv;
    let mockRelease: ReturnType<typeof jest.fn>;
    let mockPoolEnd: ReturnType<typeof jest.fn>;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = {
            ...originalEnv,
            MAP_DATA_BUCKET_NAME: 'test-map-data-bucket',
            CLOUDFRONT_DISTRIBUTION_ARN: 'arn:aws:cloudfront::123:distribution/E2',
        };

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
        jest.mocked(processGeojsons).mockResolvedValue(undefined);
        jest.mocked(makeTiles).mockResolvedValue(undefined);
        jest.mocked(uploadTilesToS3).mockResolvedValue(undefined);
        jest.mocked(invalidateCloudFrontCache).mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws when MAP_DATA_BUCKET_NAME is not set (from getMapDataBucketName at start of try)', async () => {
        delete process.env.MAP_DATA_BUCKET_NAME;

        await expect(main()).rejects.toThrow('MAP_DATA_BUCKET_NAME is required');

        expect(getDatabaseConnection).not.toHaveBeenCalled();
        expect(getMapDataIds).not.toHaveBeenCalled();
        expect(processGeojsons).not.toHaveBeenCalled();
        expect(uploadTilesToS3).not.toHaveBeenCalled();
    });

    it('throws when CLOUDFRONT_DISTRIBUTION_ARN is not set', async () => {
        delete process.env.CLOUDFRONT_DISTRIBUTION_ARN;

        await expect(main()).rejects.toThrow('CLOUDFRONT_DISTRIBUTION_ARN is required');
        expect(invalidateCloudFrontCache).not.toHaveBeenCalled();
    });

    it('fetches MapData, runs processGeojsons, makeTiles, uploads tiles to S3', async () => {
        await main();

        expect(getDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(getMapDataIds).toHaveBeenCalledWith(expect.anything());
        expect(processGeojsons).toHaveBeenCalledTimes(1);
        expect(processGeojsons).toHaveBeenCalledWith(mockMapDataIds, 'geojson', 'test-map-data-bucket');
        expect(makeTiles).toHaveBeenCalledWith('geojson', 'trails');
        expect(uploadTilesToS3).toHaveBeenCalledWith('trails', 'test-map-data-bucket');
        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(invalidateCloudFrontCache).toHaveBeenCalledWith(
            'arn:aws:cloudfront::123:distribution/E2',
            'trails'
        );
    });

    it('logs error and returns without processing when no MapData rows', async () => {
        jest.mocked(getMapDataIds).mockResolvedValue([]);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await main();

        expect(consoleErrorSpy).toHaveBeenCalledWith('No MapData rows with valid GeoJSON; skipping trail tile generation.');
        expect(processGeojsons).not.toHaveBeenCalled();
        expect(makeTiles).not.toHaveBeenCalled();
        expect(uploadTilesToS3).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it('calls invalidateCloudFrontCache when CLOUDFRONT_DISTRIBUTION_ARN is set', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = 'arn:aws:cloudfront::123456789012:distribution/E2ABC123';

        await main();

        expect(invalidateCloudFrontCache).toHaveBeenCalledTimes(1);
        expect(invalidateCloudFrontCache).toHaveBeenCalledWith(
            'arn:aws:cloudfront::123456789012:distribution/E2ABC123',
            'trails'
        );
    });

    it('releases client and ends pool when getMapDataIds throws', async () => {
        jest.mocked(getMapDataIds).mockRejectedValue(new Error('DB error'));

        await expect(main()).rejects.toThrow('DB error');

        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(processGeojsons).not.toHaveBeenCalled();
        expect(makeTiles).not.toHaveBeenCalled();
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

    it('logs thrown error when processGeojsons rejects', async () => {
        const s3Error = new Error('S3 GetObject failed');
        jest.mocked(processGeojsons).mockRejectedValue(s3Error);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('S3 GetObject failed');

        expect(consoleErrorSpy).toHaveBeenCalledWith(s3Error);
        consoleErrorSpy.mockRestore();
    });

    it('logs thrown error when makeTiles rejects', async () => {
        const tippecanoeError = new Error('tippecanoe failed');
        jest.mocked(makeTiles).mockRejectedValue(tippecanoeError);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('tippecanoe failed');

        expect(consoleErrorSpy).toHaveBeenCalledWith(tippecanoeError);
        consoleErrorSpy.mockRestore();
    });

    it('logs thrown error when uploadTilesToS3 rejects', async () => {
        const uploadError = new Error('S3 upload failed');
        jest.mocked(uploadTilesToS3).mockRejectedValue(uploadError);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('S3 upload failed');

        expect(consoleErrorSpy).toHaveBeenCalledWith(uploadError);
        consoleErrorSpy.mockRestore();
    });

    it('propagates getS3Geojson rejection from inside processGeojsons', async () => {
        jest.mocked(processGeojsons).mockRejectedValue(new Error('S3 GetObject failed'));

        await expect(main()).rejects.toThrow('S3 GetObject failed');

        expect(processGeojsons).toHaveBeenCalledWith(mockMapDataIds, 'geojson', 'test-map-data-bucket');
    });

    it('propagates makeTiles rejection', async () => {
        jest.mocked(makeTiles).mockRejectedValue(new Error('tippecanoe failed'));

        await expect(main()).rejects.toThrow('tippecanoe failed');

        expect(uploadTilesToS3).not.toHaveBeenCalled();
    });
});
