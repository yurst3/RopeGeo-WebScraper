import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type * as s from 'zapatos/schema';
import { readFileSync } from 'fs';
import getDatabaseConnection from '../../../src/helpers/getDatabaseConnection';
import { getRoutes } from '../../../src/fargate-jobs/generateRouteMarkerTiles/database/getRoutes';
import { makeGeojson } from '../../../src/fargate-jobs/generateRouteMarkerTiles/util/makeGeojson';
import { makePmtiles } from '../../../src/fargate-jobs/generateRouteMarkerTiles/util/makePmtiles';
import putS3Object from '../../../src/helpers/s3/putS3Object';
import { createCloudFrontInvalidation } from '../../../src/fargate-jobs/generateRouteMarkerTiles/cloudfront/createCloudFrontInvalidation';
import { main } from '../../../src/fargate-jobs/generateRouteMarkerTiles/main';

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateRouteMarkerTiles/database/getRoutes', () => ({ getRoutes: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateRouteMarkerTiles/util/makeGeojson', () => ({ makeGeojson: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateRouteMarkerTiles/util/makePmtiles', () => ({ makePmtiles: jest.fn() }));
jest.mock('fs', () => ({ readFileSync: jest.fn() }));
jest.mock('../../../src/helpers/s3/putS3Object', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/fargate-jobs/generateRouteMarkerTiles/cloudfront/createCloudFrontInvalidation', () => ({
    createCloudFrontInvalidation: jest.fn(),
}));

describe('main (generateRouteMarkerTiles)', () => {
    const mockRouteRows = [
        {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Route A',
            type: 'Canyon',
            coordinates: { lat: 40.0, lon: -111.0 },
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
        },
    ] as unknown as s.Route.JSONSelectable[];
    let originalEnv: NodeJS.ProcessEnv;
    let mockRelease: ReturnType<typeof jest.fn>;
    let mockPoolEnd: ReturnType<typeof jest.fn>;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv, MAP_DATA_BUCKET_NAME: 'test-map-data-bucket', CLOUDFRONT_DISTRIBUTION_ARN: '' };

        mockRelease = jest.fn();
        mockPoolEnd = jest.fn();
        jest.mocked(makeGeojson).mockImplementation(() => {});
        const mockPool = {
            connect: jest.fn(),
            end: mockPoolEnd,
        };
        // @ts-expect-error - mock pool client shape for test
        (mockPool.connect as jest.Mock).mockResolvedValue({ release: mockRelease });
        jest.mocked(getDatabaseConnection).mockResolvedValue(mockPool as unknown as Awaited<ReturnType<typeof getDatabaseConnection>>);
        jest.mocked(getRoutes).mockResolvedValue(mockRouteRows);
        jest.mocked(makePmtiles).mockResolvedValue(undefined);
        jest.mocked(readFileSync).mockReturnValue(Buffer.from('fake-pmtiles-bytes'));
        jest.mocked(putS3Object).mockResolvedValue('https://bucket.s3.amazonaws.com/pmtiles/routes.pmtiles');
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

    it('throws when CLOUDFRONT_DISTRIBUTION_ARN is not set (from getCloudfrontDistributionArn at start of try)', async () => {
        delete process.env.CLOUDFRONT_DISTRIBUTION_ARN;

        await expect(main()).rejects.toThrow('CLOUDFRONT_DISTRIBUTION_ARN is required');

        expect(getDatabaseConnection).not.toHaveBeenCalled();
    });

    it('gets routes, writes GeoJSON, runs tippecanoe, uploads to S3', async () => {
        await main();

        expect(getDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(getRoutes).toHaveBeenCalledWith(expect.anything());
        expect(makeGeojson).toHaveBeenCalledTimes(1);
        expect(makeGeojson).toHaveBeenCalledWith(expect.any(Array), '/tmp/routes.geojson');
        const makeGeojsonFirstArg = jest.mocked(makeGeojson).mock.calls[0]?.[0];
        expect(makeGeojsonFirstArg).toHaveLength(1);
        expect(makeGeojsonFirstArg?.[0]).toMatchObject({ name: 'Route A' });
        expect(makePmtiles).toHaveBeenCalledWith('/tmp/routes.geojson', '/tmp/routes.pmtiles');
        expect(readFileSync).toHaveBeenCalledWith('/tmp/routes.pmtiles');
        expect(putS3Object).toHaveBeenCalledWith(
            'test-map-data-bucket',
            'pmtiles/routes.pmtiles',
            expect.any(Buffer),
            'application/vnd.pmtiles'
        );
        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(createCloudFrontInvalidation).not.toHaveBeenCalled();
    });

    it('calls createCloudFrontInvalidation when CLOUDFRONT_DISTRIBUTION_ARN is set', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = 'arn:aws:cloudfront::123456789012:distribution/E2ABC123';

        await main();

        expect(createCloudFrontInvalidation).toHaveBeenCalledTimes(1);
        expect(createCloudFrontInvalidation).toHaveBeenCalledWith(
            'arn:aws:cloudfront::123456789012:distribution/E2ABC123'
        );
    });

    it('trims CLOUDFRONT_DISTRIBUTION_ARN when calling createCloudFrontInvalidation', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = '  arn:aws:cloudfront::123:distribution/E2  ';

        await main();

        expect(createCloudFrontInvalidation).toHaveBeenCalledWith('arn:aws:cloudfront::123:distribution/E2');
    });

    it('does not call createCloudFrontInvalidation when CLOUDFRONT_DISTRIBUTION_ARN is empty string', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = '';

        await main();

        expect(createCloudFrontInvalidation).not.toHaveBeenCalled();
    });

    it('does not call createCloudFrontInvalidation when CLOUDFRONT_DISTRIBUTION_ARN is whitespace only', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = '   ';

        await main();

        expect(createCloudFrontInvalidation).not.toHaveBeenCalled();
    });

    it('releases client and ends pool when getRoutes throws', async () => {
        jest.mocked(getRoutes).mockRejectedValue(new Error('DB error'));

        await expect(main()).rejects.toThrow('DB error');

        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(makeGeojson).not.toHaveBeenCalled();
        expect(makePmtiles).not.toHaveBeenCalled();
    });

    it('logs thrown error when getRoutes rejects', async () => {
        const dbError = new Error('DB connection failed');
        jest.mocked(getRoutes).mockRejectedValue(dbError);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('DB connection failed');

        expect(consoleErrorSpy).toHaveBeenCalledWith(dbError);
        consoleErrorSpy.mockRestore();
    });

    it('logs thrown error when makeGeojson throws', async () => {
        const writeError = new Error('write failed');
        jest.mocked(makeGeojson).mockImplementation(() => {
            throw writeError;
        });
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('write failed');

        expect(consoleErrorSpy).toHaveBeenCalledWith(writeError);
        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(makePmtiles).not.toHaveBeenCalled();
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
        const uploadError = new Error('S3 upload failed');
        jest.mocked(putS3Object).mockRejectedValue(uploadError);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(main()).rejects.toThrow('S3 upload failed');

        expect(consoleErrorSpy).toHaveBeenCalledWith(uploadError);
        consoleErrorSpy.mockRestore();
    });
});
