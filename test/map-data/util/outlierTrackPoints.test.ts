import { describe, it, expect } from '@jest/globals';
import {
    analyzeGeoJsonForTrackPointOutliers,
    cleanNonSemanticTrackPoints,
    isNonSemanticPoint,
    maybeCleanOutlierGeoJson,
} from '../../../src/map-data/util/outlierTrackPoints';
import type { OutlierIdentificationThresholds } from '../../../src/map-data/util/getOutlierIdentificationThresholds';

const thresholds: OutlierIdentificationThresholds = {
    minPointCount: 100,
    minPointsPerLine: 20,
    minPctWithinLineM: 90,
    onLineDistanceM: 5,
    minNonSemanticPct: 50,
};

function point(lon: number, lat: number, name?: string): GeoJSON.Feature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: name === undefined ? {} : { name },
    };
}

/** Dense unnamed points spaced along a short line (~every few meters). */
function buildOutlierLikeGeoJson(pointCount: number): GeoJSON.FeatureCollection {
    const lineCoords: number[][] = [
        [-105.0, 40.0],
        [-105.001, 40.0],
        [-105.002, 40.0],
    ];
    const features: GeoJSON.Feature[] = [
        {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: lineCoords },
            properties: { name: 'track' },
        },
        point(-105.0, 40.0, 'Start'),
    ];

    for (let i = 0; i < pointCount; i++) {
        const t = i / Math.max(pointCount - 1, 1);
        const lon = -105.0 - t * 0.002;
        features.push(point(lon, 40.0));
    }

    return { type: 'FeatureCollection', features };
}

describe('outlierTrackPoints', () => {
    describe('isNonSemanticPoint', () => {
        it('treats empty / missing names as non-semantic', () => {
            expect(isNonSemanticPoint(null)).toBe(true);
            expect(isNonSemanticPoint(undefined)).toBe(true);
            expect(isNonSemanticPoint({})).toBe(true);
            expect(isNonSemanticPoint({ name: '' })).toBe(true);
            expect(isNonSemanticPoint({ name: '   ' })).toBe(true);
            expect(isNonSemanticPoint({ Name: '' })).toBe(true);
        });

        it('treats auto-generated names as non-semantic', () => {
            expect(isNonSemanticPoint({ name: '001' })).toBe(true);
            expect(isNonSemanticPoint({ name: '42' })).toBe(true);
            expect(isNonSemanticPoint({ name: 'WPT006' })).toBe(true);
            expect(isNonSemanticPoint({ name: 'wpt12' })).toBe(true);
            expect(isNonSemanticPoint({ Name: 'WPT1' })).toBe(true);
        });

        it('keeps semantic waypoint names', () => {
            expect(isNonSemanticPoint({ name: 'Start' })).toBe(false);
            expect(isNonSemanticPoint({ name: 'Parking' })).toBe(false);
            expect(isNonSemanticPoint({ name: 'Rappel 1' })).toBe(false);
            expect(isNonSemanticPoint({ Name: 'End' })).toBe(false);
        });
    });

    describe('cleanNonSemanticTrackPoints', () => {
        it('removes empty and auto-named points, keeps semantic names and lines', () => {
            const geojson: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [
                                [-105, 40],
                                [-105.1, 40.1],
                            ],
                        },
                        properties: {},
                    },
                    point(-105, 40, 'Start'),
                    point(-105.05, 40.05),
                    point(-105.06, 40.06, '001'),
                    point(-105.07, 40.07, 'WPT12'),
                    point(-105.08, 40.08, 'Parking'),
                ],
            };

            const result = cleanNonSemanticTrackPoints(geojson);
            expect(result.removedPointCount).toBe(3);
            expect(result.keptPointCount).toBe(2);
            expect(result.keptFeatureCount).toBe(3);
            const names = result.geojson.features
                .filter((f) => f.geometry?.type === 'Point')
                .map((f) => (f.properties as { name?: string }).name);
            expect(names).toEqual(['Start', 'Parking']);
        });
    });

    describe('analyzeGeoJsonForTrackPointOutliers', () => {
        it('classifies dense on-line empty-name collections as outliers', () => {
            const metrics = analyzeGeoJsonForTrackPointOutliers(
                buildOutlierLikeGeoJson(120),
                thresholds,
            );
            expect(metrics.classifiedAsOutlier).toBe(true);
            expect(metrics.pointCount).toBeGreaterThanOrEqual(100);
        });

        it('classifies via points-per-line density when under minPointCount', () => {
            // 30 empty points on 1 line → points/line=30 (>=20), still under 100 points.
            const metrics = analyzeGeoJsonForTrackPointOutliers(
                buildOutlierLikeGeoJson(30),
                thresholds,
            );
            expect(metrics.pointCount).toBeLessThan(100);
            expect(metrics.pointsPerLine).toBeGreaterThanOrEqual(20);
            expect(metrics.classifiedAsOutlier).toBe(true);
        });

        it('does not classify sparse named waypoints as outliers', () => {
            const geojson: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [
                                [-105, 40],
                                [-105.1, 40],
                            ],
                        },
                        properties: {},
                    },
                    point(-105, 40, 'Start'),
                    point(-105.05, 40.01, 'Rappel 1'),
                    point(-105.1, 40, 'End'),
                ],
            };
            const metrics = analyzeGeoJsonForTrackPointOutliers(geojson, thresholds);
            expect(metrics.classifiedAsOutlier).toBe(false);
        });
    });

    describe('maybeCleanOutlierGeoJson', () => {
        it('cleans when classified as outlier', () => {
            const result = maybeCleanOutlierGeoJson(buildOutlierLikeGeoJson(120), thresholds);
            expect(result.cleaned).toBe(true);
            expect(result.cleanResult?.removedPointCount).toBeGreaterThan(0);
            const points = result.geojson.features.filter((f) => f.geometry?.type === 'Point');
            expect(points).toHaveLength(1);
            expect((points[0]!.properties as { name?: string }).name).toBe('Start');
        });

        it('leaves normal geojson unchanged', () => {
            const geojson: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [
                                [-105, 40],
                                [-105.1, 40],
                            ],
                        },
                        properties: {},
                    },
                    point(-105, 40, 'Start'),
                    point(-105.1, 40, 'End'),
                ],
            };
            const result = maybeCleanOutlierGeoJson(geojson, thresholds);
            expect(result.cleaned).toBe(false);
            expect(result.geojson.features).toHaveLength(3);
        });
    });
});
