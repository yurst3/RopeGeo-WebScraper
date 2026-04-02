import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { getMapDataBucketName } from '../../../../src/fargate-tasks/generateTrailTiles/s3/getMapDataBucketName';
import { getS3Geojson } from '../../../../src/fargate-tasks/generateTrailTiles/s3/getS3Geojson';
import { getS3Object } from 'ropegeo-common/helpers';

jest.mock('ropegeo-common/helpers', () => ({ __esModule: true, getS3Object: jest.fn() }));

describe('getS3Geojson', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv, MAP_DATA_BUCKET_NAME: 'test-map-bucket' };
        jest.mocked(getS3Object).mockResolvedValue({ body: '{"type":"FeatureCollection","features":[]}' });
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('getMapDataBucketName', () => {
        it('returns MAP_DATA_BUCKET_NAME from env', () => {
            expect(getMapDataBucketName()).toBe('test-map-bucket');
        });

        it('throws when MAP_DATA_BUCKET_NAME is not set', () => {
            delete process.env.MAP_DATA_BUCKET_NAME;

            expect(() => getMapDataBucketName()).toThrow('MAP_DATA_BUCKET_NAME is required');
        });
    });

    describe('getS3Geojson', () => {
        it('fetches geojson from S3, parses and returns FeatureCollection', async () => {
            const bucket = 'test-map-bucket';
            const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
            const body = '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[0,0],[1,1]]}}]}';
            jest.mocked(getS3Object).mockResolvedValue({ body });

            const result = await getS3Geojson(bucket, id);

            expect(result).toEqual({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }] });
            expect(getS3Object).toHaveBeenCalledWith(bucket, `geojson/${id}.geojson`);
        });

        it('throws when parsed JSON is not a FeatureCollection', async () => {
            jest.mocked(getS3Object).mockResolvedValue({ body: '{"type":"Point","coordinates":[0,0]}' });

            await expect(getS3Geojson('bucket', 'id')).rejects.toThrow(
                /MapData id: expected a GeoJSON FeatureCollection with a features array/
            );
        });

        it('throws when features is not an array', async () => {
            jest.mocked(getS3Object).mockResolvedValue({ body: '{"type":"FeatureCollection","features":null}' });

            await expect(getS3Geojson('bucket', 'id')).rejects.toThrow(
                /expected a GeoJSON FeatureCollection with a features array/
            );
        });

        it('propagates getS3Object rejection', async () => {
            jest.mocked(getS3Object).mockRejectedValue(new Error('S3 error'));

            await expect(getS3Geojson('bucket', 'some-id')).rejects.toThrow('S3 error');
        });
    });
});
