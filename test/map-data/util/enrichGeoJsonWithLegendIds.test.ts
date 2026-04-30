import { describe, it, expect } from '@jest/globals';
import { LegendFeatureType, LineLegendItem, PointLegendItem } from 'ropegeo-common/models';
import {
    buildLegendFromGeoJson,
    enrichGeoJsonWithLegendIds,
    LEGEND_ID_PROPERTY,
} from '../../../src/map-data/util/enrichGeoJsonWithLegendIds';

describe('enrichGeoJsonWithLegendIds', () => {
    it('returns undefined for an empty FeatureCollection', () => {
        expect(buildLegendFromGeoJson({ type: 'FeatureCollection', features: [] })).toBeUndefined();
    });

    it('creates a LineLegendItem per LineString', () => {
        const fc: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    id: 'trail-a',
                    properties: { name: 'North fork' },
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [-110.0, 38.2],
                            [-109.5, 38.4],
                        ],
                    },
                },
            ],
        };
        const legend = buildLegendFromGeoJson(fc);
        expect(legend).toBeDefined();
        const entries = Object.values(legend!);
        expect(entries).toHaveLength(1);
        const item = entries[0]!;
        expect(item).toBeInstanceOf(LineLegendItem);
        expect(item.featureType).toBe(LegendFeatureType.Line);
        expect(item.name).toBe('North fork');
        expect(item.bounds.west).toBe(-110.0);
        expect(item.bounds.east).toBe(-109.5);
        expect(Object.keys(legend!)[0]).toBe(item.id);
    });

    it('splits MultiLineString into multiple line entries', () => {
        const fc: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    id: 'm',
                    properties: {},
                    geometry: {
                        type: 'MultiLineString',
                        coordinates: [
                            [
                                [-110, 38],
                                [-109.9, 38.1],
                            ],
                            [
                                [-109.8, 38.0],
                                [-109.7, 38.05],
                            ],
                        ],
                    },
                },
            ],
        };
        const legend = buildLegendFromGeoJson(fc);
        const entries = Object.values(legend!);
        expect(entries).toHaveLength(2);
        expect(entries.every((e) => e instanceof LineLegendItem)).toBe(true);
        expect(new Set(entries.map((e) => e.id)).size).toBe(2);
    });

    it('creates PointLegendItem for Point geometry', () => {
        const fc: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { name: 'Start' },
                    geometry: { type: 'Point', coordinates: [-109.0, 38.5] },
                },
            ],
        };
        const legend = buildLegendFromGeoJson(fc);
        const entries = Object.values(legend!);
        expect(entries).toHaveLength(1);
        const item = entries[0]!;
        expect(item).toBeInstanceOf(PointLegendItem);
        expect((item as PointLegendItem).coordinates.lat).toBe(38.5);
        expect((item as PointLegendItem).coordinates.lon).toBe(-109.0);
    });

    it('enrichGeoJsonWithLegendIds writes legendId on Point features', () => {
        const fc: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { name: 'P' },
                    geometry: { type: 'Point', coordinates: [-109, 38.5] },
                },
            ],
        };
        const { geoJson, legend } = enrichGeoJsonWithLegendIds(fc);
        expect(geoJson.features).toHaveLength(1);
        const f = geoJson.features[0]!;
        const props = f.properties as Record<string, string>;
        expect(props[LEGEND_ID_PROPERTY]).toBeDefined();
        expect(Object.keys(legend!)[0]).toBe(props[LEGEND_ID_PROPERTY]);
    });
});
