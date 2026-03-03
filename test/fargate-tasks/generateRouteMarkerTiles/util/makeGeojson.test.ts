import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { makeGeojson } from '../../../../src/fargate-tasks/generateRouteMarkerTiles/util/makeGeojson';
import type * as s from 'zapatos/schema';

jest.mock('fs', () => ({
    writeFileSync: jest.fn(),
}));

import { writeFileSync } from 'fs';

describe('makeGeojson', () => {
    const outputPath = '/tmp/routes.geojson';

    beforeEach(() => {
        jest.mocked(writeFileSync).mockClear();
    });

    it('writes a GeoJSON FeatureCollection with point features for each route', () => {
        const routes: s.Route.JSONSelectable[] = [
            {
                id: '11111111-1111-1111-1111-111111111111',
                name: 'Route A',
                type: 'Canyon',
                coordinates: { lat: 40.0, lon: -111.0 },
                createdAt: new Date('2025-01-01'),
                updatedAt: new Date('2025-01-01'),
                deletedAt: null,
            },
            {
                id: '22222222-2222-2222-2222-222222222222',
                name: 'Route B',
                type: 'Cave',
                coordinates: { lat: 41.0, lon: -112.0 },
                createdAt: new Date('2025-01-02'),
                updatedAt: new Date('2025-01-02'),
                deletedAt: null,
            },
        ];

        makeGeojson(routes, outputPath);

        expect(writeFileSync).toHaveBeenCalledTimes(1);
        expect(writeFileSync).toHaveBeenCalledWith(outputPath, expect.any(String), 'utf8');
        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written.type).toBe('FeatureCollection');
        expect(written.features).toHaveLength(2);
        expect(written.features[0]).toEqual({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-111.0, 40.0] },
            properties: { id: routes[0].id, name: 'Route A', type: 'Canyon' },
        });
        expect(written.features[1]).toEqual({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-112.0, 41.0] },
            properties: { id: routes[1].id, name: 'Route B', type: 'Cave' },
        });
    });

    it('writes valid GeoJSON when routes array is empty', () => {
        makeGeojson([], outputPath);

        expect(writeFileSync).toHaveBeenCalledWith(
            outputPath,
            JSON.stringify({ type: 'FeatureCollection', features: [] }),
            'utf8'
        );
    });
});
