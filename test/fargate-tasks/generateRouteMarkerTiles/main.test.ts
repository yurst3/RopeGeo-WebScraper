import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type * as s from 'zapatos/schema';
import getDatabaseConnection from '../../../src/helpers/getDatabaseConnection';
import { getRoutes } from '../../../src/fargate-tasks/generateRouteMarkerTiles/database/getRoutes';
import { makeGeojson } from '../../../src/fargate-tasks/generateRouteMarkerTiles/util/makeGeojson';
import { makeTiles } from '../../../src/fargate-tasks/generateRouteMarkerTiles/util/makeTiles';
import { uploadTilesToS3 } from '../../../src/fargate-tasks/generateRouteMarkerTiles/s3/uploadTilesToS3';
import { invalidateCloudFrontCache } from '../../../src/fargate-tasks/generateRouteMarkerTiles/cloudfront/invalidateCloudFrontCache';
import { main } from '../../../src/fargate-tasks/generateRouteMarkerTiles/main';

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/fargate-tasks/generateRouteMarkerTiles/database/getRoutes', () => ({ getRoutes: jest.fn() }));
jest.mock('../../../src/fargate-tasks/generateRouteMarkerTiles/util/makeGeojson', () => ({ makeGeojson: jest.fn() }));
jest.mock('../../../src/fargate-tasks/generateRouteMarkerTiles/util/makeTiles', () => ({ makeTiles: jest.fn() }));
jest.mock('../../../src/fargate-tasks/generateRouteMarkerTiles/s3/uploadTilesToS3', () => ({ uploadTilesToS3: jest.fn() }));
jest.mock('../../../src/fargate-tasks/generateRouteMarkerTiles/cloudfront/invalidateCloudFrontCache', () => ({
    invalidateCloudFrontCache: jest.fn(),
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
        process.env = {
            ...originalEnv,
            MAP_DATA_BUCKET_NAME: 'test-map-data-bucket',
            CLOUDFRONT_DISTRIBUTION_ARN: 'arn:aws:cloudfront::123:distribution/E2',
        };

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
        jest.mocked(makeTiles).mockResolvedValue(undefined);
        jest.mocked(uploadTilesToS3).mockResolvedValue(undefined);
        jest.mocked(invalidateCloudFrontCache).mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws when MAP_DATA_BUCKET_NAME is not set', async () => {
        delete process.env.MAP_DATA_BUCKET_NAME;

        await expect(main()).rejects.toThrow('MAP_DATA_BUCKET_NAME is required');

        expect(getDatabaseConnection).not.toHaveBeenCalled();
    });

    it('throws when CLOUDFRONT_DISTRIBUTION_ARN is not set', async () => {
        delete process.env.CLOUDFRONT_DISTRIBUTION_ARN;

        await expect(main()).rejects.toThrow('CLOUDFRONT_DISTRIBUTION_ARN is required');
        expect(invalidateCloudFrontCache).not.toHaveBeenCalled();
    });

    it('gets routes, writes GeoJSON, runs makeTiles, uploads tiles to S3', async () => {
        await main();

        expect(getDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(getRoutes).toHaveBeenCalledWith(expect.anything());
        expect(makeGeojson).toHaveBeenCalledTimes(1);
        expect(makeGeojson).toHaveBeenCalledWith(expect.any(Array), '/tmp/routes.geojson');
        const makeGeojsonFirstArg = jest.mocked(makeGeojson).mock.calls[0]?.[0];
        expect(makeGeojsonFirstArg).toHaveLength(1);
        expect(makeGeojsonFirstArg?.[0]).toMatchObject({ name: 'Route A' });
        expect(makeTiles).toHaveBeenCalledWith('routes.geojson', 'routeMarkers');
        expect(uploadTilesToS3).toHaveBeenCalledWith('routeMarkers', 'test-map-data-bucket');
        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(invalidateCloudFrontCache).toHaveBeenCalledWith(
            'arn:aws:cloudfront::123:distribution/E2',
            'routeMarkers'
        );
    });

    it('calls invalidateCloudFrontCache when CLOUDFRONT_DISTRIBUTION_ARN is set', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = 'arn:aws:cloudfront::123456789012:distribution/E2ABC123';

        await main();

        expect(invalidateCloudFrontCache).toHaveBeenCalledTimes(1);
        expect(invalidateCloudFrontCache).toHaveBeenCalledWith(
            'arn:aws:cloudfront::123456789012:distribution/E2ABC123',
            'routeMarkers'
        );
    });

    it('trims CLOUDFRONT_DISTRIBUTION_ARN when calling invalidateCloudFrontCache', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = '  arn:aws:cloudfront::123:distribution/E2  ';

        await main();

        expect(invalidateCloudFrontCache).toHaveBeenCalledWith(
            'arn:aws:cloudfront::123:distribution/E2',
            'routeMarkers'
        );
    });

    it('throws when CLOUDFRONT_DISTRIBUTION_ARN is empty string', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = '';

        await expect(main()).rejects.toThrow('CLOUDFRONT_DISTRIBUTION_ARN is required');
        expect(invalidateCloudFrontCache).not.toHaveBeenCalled();
    });

    it('logs error and returns without processing when no routes from database', async () => {
        jest.mocked(getRoutes).mockResolvedValue([]);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await main();

        expect(consoleErrorSpy).toHaveBeenCalledWith('No routes from database; skipping route marker tile generation.');
        expect(makeGeojson).not.toHaveBeenCalled();
        expect(makeTiles).not.toHaveBeenCalled();
        expect(uploadTilesToS3).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it('throws when CLOUDFRONT_DISTRIBUTION_ARN is whitespace only', async () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = '   ';

        await expect(main()).rejects.toThrow('CLOUDFRONT_DISTRIBUTION_ARN is required');
        expect(invalidateCloudFrontCache).not.toHaveBeenCalled();
    });

    it('releases client and ends pool when getRoutes throws', async () => {
        jest.mocked(getRoutes).mockRejectedValue(new Error('DB error'));

        await expect(main()).rejects.toThrow('DB error');

        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(makeGeojson).not.toHaveBeenCalled();
        expect(makeTiles).not.toHaveBeenCalled();
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
        expect(makeTiles).not.toHaveBeenCalled();
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
});
