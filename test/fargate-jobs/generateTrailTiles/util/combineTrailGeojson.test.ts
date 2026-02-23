import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { combineTrailGeojson } from '../../../../src/fargate-jobs/generateTrailTiles/util/combineTrailGeojson';

jest.mock('fs', () => ({
    writeFileSync: jest.fn(),
}));

import { writeFileSync } from 'fs';

describe('combineTrailGeojson', () => {
    const outputPath = '/tmp/trails.geojson';

    beforeEach(() => {
        jest.mocked(writeFileSync).mockClear();
    });

    it('writes a GeoJSON FeatureCollection with id on each feature', () => {
        const inputs = [
            {
                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                geojsonBody: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Trail A' } },
                    ],
                }),
            },
        ];

        combineTrailGeojson(inputs, outputPath);

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

    it('combines multiple inputs and tags each feature with id', () => {
        const inputs = [
            {
                id: 'id-1',
                geojsonBody: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} },
                    ],
                }),
            },
            {
                id: 'id-2',
                geojsonBody: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] }, properties: {} },
                    ],
                }),
            },
        ];

        combineTrailGeojson(inputs, outputPath);

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(2);
        expect(written.features[0].properties).toEqual({ id: 'id-1' });
        expect(written.features[1].properties).toEqual({ id: 'id-2' });
    });

    it('includes LineString and Polygon, filters out Point', () => {
        const inputs = [
            {
                id: 'id-1',
                geojsonBody: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: { name: 'Area' } },
                    ],
                }),
            },
        ];

        combineTrailGeojson(inputs, outputPath);

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(1);
        expect(written.features[0].geometry.type).toBe('Polygon');
        expect(written.features[0].properties).toMatchObject({ id: 'id-1', name: 'Area' });
    });

    it('filters out Point geometries', () => {
        const inputs = [
            {
                id: 'id-1',
                geojsonBody: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
                        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { name: 'Trail' } },
                    ],
                }),
            },
        ];

        combineTrailGeojson(inputs, outputPath);

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(1);
        expect(written.features[0].geometry.type).toBe('LineString');
        expect(written.features[0].properties).toMatchObject({ id: 'id-1', name: 'Trail' });
    });

    it('unpacks GeometryCollection into separate features with parent properties', () => {
        const inputs = [
            {
                id: 'map-data-id',
                geojsonBody: JSON.stringify({
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
                }),
            },
        ];

        combineTrailGeojson(inputs, outputPath);

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

    it('writes valid empty FeatureCollection when inputs is empty', () => {
        combineTrailGeojson([], outputPath);

        expect(writeFileSync).toHaveBeenCalledWith(
            outputPath,
            JSON.stringify({ type: 'FeatureCollection', features: [] }),
            'utf8'
        );
    });

    it('skips non-FeatureCollection or invalid feature entries', () => {
        const inputs = [
            {
                id: 'id-1',
                geojsonBody: JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } }] }),
            },
            {
                id: 'id-2',
                geojsonBody: JSON.stringify({ type: 'Point', coordinates: [1, 1] }),
            },
        ];

        combineTrailGeojson(inputs, outputPath);

        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.features).toHaveLength(0);
    });
});
