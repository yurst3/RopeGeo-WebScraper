import { describe, it, expect } from '@jest/globals';
import { getBoundsFromGeoJson } from '../../../src/map-data/util/getBoundsFromGeoJson';

describe('getBoundsFromGeoJson', () => {
    it('returns null for empty FeatureCollection', () => {
        const geoJson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
        expect(getBoundsFromGeoJson(geoJson)).toBeNull();
    });

    it('returns null for FeatureCollection with no features array', () => {
        const geoJson = { type: 'FeatureCollection' } as GeoJSON.FeatureCollection;
        expect(getBoundsFromGeoJson(geoJson)).toBeNull();
    });

    it('returns bounds for single Point feature', () => {
        const geoJson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [-122.5, 47.5] },
                    properties: {},
                },
            ],
        };
        const bounds = getBoundsFromGeoJson(geoJson);
        expect(bounds).toEqual({ north: 47.5, south: 47.5, east: -122.5, west: -122.5 });
    });

    it('returns bounds for LineString feature', () => {
        const geoJson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [-123, 48],
                            [-122, 47],
                            [-121, 49],
                        ],
                    },
                    properties: {},
                },
            ],
        };
        const bounds = getBoundsFromGeoJson(geoJson);
        expect(bounds).toEqual({ north: 49, south: 47, east: -121, west: -123 });
    });

    it('returns bounds for Polygon feature', () => {
        const geoJson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [-124, 46],
                                [-120, 46],
                                [-120, 49],
                                [-124, 49],
                                [-124, 46],
                            ],
                        ],
                    },
                    properties: {},
                },
            ],
        };
        const bounds = getBoundsFromGeoJson(geoJson);
        expect(bounds).toEqual({ north: 49, south: 46, east: -120, west: -124 });
    });

    it('returns bounds for GeometryCollection with nested geometries', () => {
        const geoJson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'GeometryCollection',
                        geometries: [
                            { type: 'Point', coordinates: [-122, 47] },
                            { type: 'Point', coordinates: [-121, 48] },
                        ],
                    },
                    properties: {},
                },
            ],
        };
        const bounds = getBoundsFromGeoJson(geoJson);
        expect(bounds).toEqual({ north: 48, south: 47, east: -121, west: -122 });
    });

    it('returns bounds for nested GeometryCollection', () => {
        const geoJson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'GeometryCollection',
                        geometries: [
                            {
                                type: 'GeometryCollection',
                                geometries: [
                                    { type: 'Point', coordinates: [-125, 45] },
                                    { type: 'Point', coordinates: [-119, 50] },
                                ],
                            },
                        ],
                    },
                    properties: {},
                },
            ],
        };
        const bounds = getBoundsFromGeoJson(geoJson);
        expect(bounds).toEqual({ north: 50, south: 45, east: -119, west: -125 });
    });

    it('returns null when features have no geometry', () => {
        const geoJson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: null, properties: {} },
                { type: 'Feature', geometry: null, properties: {} },
            ],
        };
        expect(getBoundsFromGeoJson(geoJson)).toBeNull();
    });

    it('aggregates bounds across multiple features', () => {
        const geoJson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [-123, 46] },
                    properties: {},
                },
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [-121, 48] },
                    properties: {},
                },
            ],
        };
        const bounds = getBoundsFromGeoJson(geoJson);
        expect(bounds).toEqual({ north: 48, south: 46, east: -121, west: -123 });
    });
});
