import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { combineTrailGeojson } from '../../../../src/fargate-jobs/generateTrailTiles/util/combineTrailGeojson';
import { getS3Geojson } from '../../../../src/fargate-jobs/generateTrailTiles/s3/getS3Geojson';

jest.mock('fs', () => ({ writeFileSync: jest.fn() }));
jest.mock('../../../../src/fargate-jobs/generateTrailTiles/s3/getS3Geojson', () => ({
    getS3Geojson: jest.fn(),
}));
const mockLogError = jest.fn();
const mockLogProgress = jest.fn();
jest.mock('../../../../src/helpers/progressLogger', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({ logProgress: mockLogProgress, logError: mockLogError })),
}));

import { writeFileSync } from 'fs';

describe('combineTrailGeojson', () => {
    const outputPath = '/tmp/trails.geojson';

    beforeEach(() => {
        jest.mocked(writeFileSync).mockClear();
        jest.mocked(getS3Geojson).mockClear();
        mockLogError.mockClear();
        mockLogProgress.mockClear();
    });

    it('writes a GeoJSON FeatureCollection with id on each feature', async () => {
        const ids = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Trail A' } },
            ],
        } as GeoJSON.FeatureCollection);

        await combineTrailGeojson(ids, outputPath, 'test-bucket');

        expect(writeFileSync).toHaveBeenCalledTimes(1);
        expect(writeFileSync).toHaveBeenCalledWith(outputPath, expect.any(String), 'utf8');
        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.type).toBe('FeatureCollection');
        expect(written.features).toHaveLength(1);
        expect(written.features[0].properties).toMatchObject({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'Trail A',
        });
        expect(written.features[0].geometry).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 1]] });
    });

    it('combines multiple inputs and tags each feature with id', async () => {
        const ids = ['id-1', 'id-2'];
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

        await combineTrailGeojson(ids, outputPath, 'test-bucket');

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(2);
        expect(written.features[0].properties).toEqual({ id: 'id-1' });
        expect(written.features[1].properties).toEqual({ id: 'id-2' });
    });

    it('includes LineString and Polygon, filters out Point', async () => {
        const ids = ['id-1'];
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: { name: 'Area' } },
            ],
        } as GeoJSON.FeatureCollection);

        await combineTrailGeojson(ids, outputPath, 'test-bucket');

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(1);
        expect(written.features[0].geometry.type).toBe('Polygon');
        expect(written.features[0].properties).toMatchObject({ id: 'id-1', name: 'Area' });
    });

    it('filters out Point geometries', async () => {
        const ids = ['id-1'];
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Trail' } },
            ],
        } as GeoJSON.FeatureCollection);

        await combineTrailGeojson(ids, outputPath, 'test-bucket');

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(1);
        expect(written.features[0].geometry.type).toBe('LineString');
        expect(written.features[0].properties).toMatchObject({ id: 'id-1', name: 'Trail' });
    });

    it('filters out invalid features (wrong type or missing geometry)', async () => {
        const ids = ['id-1'];
        jest.mocked(getS3Geojson).mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: null, properties: {} } as GeoJSON.Feature,
                { type: 'Feature', geometry: undefined, properties: {} } as GeoJSON.Feature,
                { type: 'NotAFeature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} } as GeoJSON.Feature,
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Valid' } },
            ],
        } as GeoJSON.FeatureCollection);

        await combineTrailGeojson(ids, outputPath, 'test-bucket');

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(1);
        expect(written.features[0].properties).toMatchObject({ id: 'id-1', name: 'Valid' });
    });

    it('unpacks GeometryCollection into separate features with parent properties', async () => {
        const ids = ['map-data-id'];
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

        await combineTrailGeojson(ids, outputPath, 'test-bucket');

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(2);
        expect(written.features[0].geometry).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 1]] });
        expect(written.features[0].properties).toMatchObject({
            id: 'map-data-id',
            name: 'Parent Trail',
            stroke: '#FF0000',
        });
        expect(written.features[1].geometry).toEqual({ type: 'LineString', coordinates: [[1, 1], [2, 2]] });
        expect(written.features[1].properties).toMatchObject({
            id: 'map-data-id',
            name: 'Parent Trail',
            stroke: '#FF0000',
        });
    });

    it('recursively expands nested GeometryCollections at multiple layers', async () => {
        const ids = ['nested-id'];
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

        await combineTrailGeojson(ids, outputPath, 'test-bucket');

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(4);
        expect(written.features[0].geometry).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 0]] });
        expect(written.features[1].geometry).toEqual({ type: 'LineString', coordinates: [[1, 0], [2, 0]] });
        expect(written.features[2].geometry).toEqual({ type: 'Polygon', coordinates: [[[2, 0], [3, 0], [3, 1], [2, 0]]] });
        expect(written.features[3].geometry).toEqual({ type: 'LineString', coordinates: [[3, 0], [4, 0]] });
        const expectedProps = { id: 'nested-id', name: 'Nested Trail', layer: 'outer' };
        written.features.forEach((f: { properties?: Record<string, unknown> }) => {
            expect(f.properties).toMatchObject(expectedProps);
        });
    });

    it('writes valid empty FeatureCollection when ids is empty', async () => {
        await combineTrailGeojson([], outputPath, 'test-bucket');

        expect(writeFileSync).toHaveBeenCalledWith(
            outputPath,
            JSON.stringify({ type: 'FeatureCollection', features: [] }),
            'utf8'
        );
        expect(getS3Geojson).not.toHaveBeenCalled();
    });

    it('calls logError and continues when getS3Geojson throws', async () => {
        const ids = ['id-1', 'id-2'];
        jest.mocked(getS3Geojson)
            .mockResolvedValueOnce({
                type: 'FeatureCollection',
                features: [
                    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} },
                ],
            } as GeoJSON.FeatureCollection)
            .mockRejectedValueOnce(new Error('MapData id-2: invalid GeoJSON'));

        await combineTrailGeojson(ids, outputPath, 'test-bucket');

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(1);
        expect(mockLogError).toHaveBeenCalledTimes(1);
        expect(mockLogError).toHaveBeenCalledWith('MapData id-2: invalid GeoJSON');
    });
});
