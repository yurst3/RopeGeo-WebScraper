import { describe, it, expect } from '@jest/globals';
import { splitGeoJsonByPointGeometry } from '../../../src/map-data/util/splitGeoJsonByPointGeometry';

describe('splitGeoJsonByPointGeometry', () => {
    it('puts Point and MultiPoint into points', () => {
        const fc = {
            type: 'FeatureCollection' as const,
            features: [
                {
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [0, 0] },
                    properties: {},
                },
                {
                    type: 'Feature' as const,
                    geometry: { type: 'MultiPoint' as const, coordinates: [
                            [1, 1],
                            [2, 2],
                        ],
                    },
                    properties: {},
                },
                {
                    type: 'Feature' as const,
                    geometry: { type: 'LineString' as const, coordinates: [
                            [0, 0],
                            [3, 3],
                        ],
                    },
                    properties: {},
                },
            ],
        };
        const { points, polyLines } = splitGeoJsonByPointGeometry(fc);
        expect(points.features).toHaveLength(2);
        expect(polyLines.features).toHaveLength(1);
    });

    it('skips null geometry', () => {
        const fc = {
            type: 'FeatureCollection' as const,
            features: [
                { type: 'Feature' as const, geometry: null, properties: {} },
                {
                    type: 'Feature' as const,
                    geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
                    properties: {},
                },
            ],
        };
        const { points, polyLines } = splitGeoJsonByPointGeometry(fc);
        expect(points.features).toHaveLength(0);
        expect(polyLines.features).toHaveLength(1);
    });
});
