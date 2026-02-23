import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getFeaturesForGeojson } from '../../../../src/fargate-jobs/generateTrailTiles/util/getFeaturesForGeojson';
import { getS3Geojson } from '../../../../src/fargate-jobs/generateTrailTiles/s3/getS3Geojson';

jest.mock('../../../../src/fargate-jobs/generateTrailTiles/s3/getS3Geojson', () => ({
    getS3Geojson: jest.fn(),
}));

describe('getFeaturesForGeojson', () => {
    const bucket = 'test-bucket';

    beforeEach(() => {
        jest.mocked(getS3Geojson).mockClear();
    });

    it('returns features with id on each when single LineString', async () => {
        const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Trail A' } },
            ],
        } as GeoJSON.FeatureCollection);

        const features = await getFeaturesForGeojson(id, bucket);

        expect(getS3Geojson).toHaveBeenCalledWith(bucket, id);
        expect(features).toHaveLength(1);
        expect(features[0].properties).toMatchObject({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'Trail A',
        });
        expect(features[0].geometry).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 1]] });
    });

    it('returns multiple features tagged with id', async () => {
        jest.mocked(getS3Geojson)
            .mockResolvedValueOnce({
                type: 'FeatureCollection',
                features: [
                    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} },
                ],
            } as GeoJSON.FeatureCollection)
            .mockResolvedValueOnce({
                type: 'FeatureCollection',
                features: [
                    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] }, properties: {} },
                ],
            } as GeoJSON.FeatureCollection);

        const features1 = await getFeaturesForGeojson('id-1', bucket);
        const features2 = await getFeaturesForGeojson('id-2', bucket);

        expect(features1).toHaveLength(1);
        expect(features1[0].properties).toEqual({ id: 'id-1' });
        expect(features2).toHaveLength(1);
        expect(features2[0].properties).toEqual({ id: 'id-2' });
    });

    it('filters out Point geometries and keeps LineString/Polygon', async () => {
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Trail' } },
            ],
        } as GeoJSON.FeatureCollection);

        const features = await getFeaturesForGeojson('id-1', bucket);

        expect(features).toHaveLength(1);
        expect(features[0].geometry.type).toBe('LineString');
        expect(features[0].properties).toMatchObject({ id: 'id-1', name: 'Trail' });
    });

    it('includes Polygon', async () => {
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: { name: 'Area' } },
            ],
        } as GeoJSON.FeatureCollection);

        const features = await getFeaturesForGeojson('id-1', bucket);

        expect(features).toHaveLength(1);
        expect(features[0].geometry.type).toBe('Polygon');
        expect(features[0].properties).toMatchObject({ id: 'id-1', name: 'Area' });
    });

    it('returns empty array when all features are Points', async () => {
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
                { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: {} },
            ],
        } as GeoJSON.FeatureCollection);

        const features = await getFeaturesForGeojson('id-points-only', bucket);

        expect(features).toHaveLength(0);
    });

    it('filters out invalid features (wrong type or missing geometry)', async () => {
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: null, properties: {} } as GeoJSON.Feature,
                { type: 'Feature', geometry: undefined, properties: {} } as GeoJSON.Feature,
                { type: 'NotAFeature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} } as GeoJSON.Feature,
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Valid' } },
            ],
        } as GeoJSON.FeatureCollection);

        const features = await getFeaturesForGeojson('id-1', bucket);

        expect(features).toHaveLength(1);
        expect(features[0].properties).toMatchObject({ id: 'id-1', name: 'Valid' });
    });

    it('unpacks GeometryCollection into separate features with parent properties', async () => {
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'GeometryCollection',
                        geometries: [
                            { type: 'Point', coordinates: [0, 0] },
                            { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
                            { type: 'LineString', coordinates: [[1, 1], [2, 2]] },
                        ],
                    },
                    properties: { name: 'Parent Trail', stroke: '#FF0000' },
                },
            ],
        } as GeoJSON.FeatureCollection);

        const features = await getFeaturesForGeojson('map-data-id', bucket);

        expect(features).toHaveLength(2);
        expect(features[0].geometry).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 1]] });
        expect(features[0].properties).toMatchObject({
            id: 'map-data-id',
            name: 'Parent Trail',
            stroke: '#FF0000',
        });
        expect(features[1].geometry).toEqual({ type: 'LineString', coordinates: [[1, 1], [2, 2]] });
        expect(features[1].properties).toMatchObject({
            id: 'map-data-id',
            name: 'Parent Trail',
            stroke: '#FF0000',
        });
    });

    it('recursively expands nested GeometryCollections', async () => {
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'GeometryCollection',
                        geometries: [
                            { type: 'Point', coordinates: [0, 0] },
                            { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
                            {
                                type: 'GeometryCollection',
                                geometries: [
                                    { type: 'LineString', coordinates: [[1, 0], [2, 0]] },
                                    {
                                        type: 'GeometryCollection',
                                        geometries: [
                                            { type: 'Polygon', coordinates: [[[2, 0], [3, 0], [3, 1], [2, 0]]] },
                                            { type: 'LineString', coordinates: [[3, 0], [4, 0]] },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    properties: { name: 'Nested Trail', layer: 'outer' },
                },
            ],
        } as GeoJSON.FeatureCollection);

        const features = await getFeaturesForGeojson('nested-id', bucket);

        expect(features).toHaveLength(4);
        expect(features[0].geometry).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 0]] });
        expect(features[1].geometry).toEqual({ type: 'LineString', coordinates: [[1, 0], [2, 0]] });
        expect(features[2].geometry).toEqual({ type: 'Polygon', coordinates: [[[2, 0], [3, 0], [3, 1], [2, 0]]] });
        expect(features[3].geometry).toEqual({ type: 'LineString', coordinates: [[3, 0], [4, 0]] });
        const expectedProps = { id: 'nested-id', name: 'Nested Trail', layer: 'outer' };
        features.forEach((f) => {
            expect(f.properties).toMatchObject(expectedProps);
        });
    });

    it('throws when getS3Geojson throws', async () => {
        jest.mocked(getS3Geojson).mockRejectedValue(new Error('S3 GetObject failed'));

        await expect(getFeaturesForGeojson('id-1', bucket)).rejects.toThrow('S3 GetObject failed');
    });
});
