import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getOutlierIdentificationThresholds } from '../../../src/map-data/util/getOutlierIdentificationThresholds';

describe('getOutlierIdentificationThresholds', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.MAP_DATA_OUTLIER_MIN_POINT_COUNT;
        delete process.env.MAP_DATA_OUTLIER_MIN_POINTS_PER_LINE;
        delete process.env.MAP_DATA_OUTLIER_MIN_PCT_WITHIN_LINE_M;
        delete process.env.MAP_DATA_OUTLIER_ON_LINE_DISTANCE_M;
        delete process.env.MAP_DATA_OUTLIER_MIN_NON_SEMANTIC_PCT;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns tuned defaults when env vars are unset', () => {
        expect(getOutlierIdentificationThresholds()).toEqual({
            minPointCount: 100,
            minPointsPerLine: 20,
            minPctWithinLineM: 90,
            onLineDistanceM: 5,
            minNonSemanticPct: 50,
        });
    });

    it('reads overrides from environment variables', () => {
        process.env.MAP_DATA_OUTLIER_MIN_POINT_COUNT = '150';
        process.env.MAP_DATA_OUTLIER_MIN_POINTS_PER_LINE = '25';
        process.env.MAP_DATA_OUTLIER_MIN_PCT_WITHIN_LINE_M = '85';
        process.env.MAP_DATA_OUTLIER_ON_LINE_DISTANCE_M = '10';
        process.env.MAP_DATA_OUTLIER_MIN_NON_SEMANTIC_PCT = '60';

        expect(getOutlierIdentificationThresholds()).toEqual({
            minPointCount: 150,
            minPointsPerLine: 25,
            minPctWithinLineM: 85,
            onLineDistanceM: 10,
            minNonSemanticPct: 60,
        });
    });

    it('throws when an env var is not a non-negative number', () => {
        process.env.MAP_DATA_OUTLIER_MIN_POINT_COUNT = 'abc';
        expect(() => getOutlierIdentificationThresholds()).toThrow(
            /MAP_DATA_OUTLIER_MIN_POINT_COUNT must be a non-negative number/,
        );
    });

    it('treats blank env values as unset defaults', () => {
        process.env.MAP_DATA_OUTLIER_MIN_POINT_COUNT = '  ';
        expect(getOutlierIdentificationThresholds().minPointCount).toBe(100);
    });

    it('throws when an env var is negative', () => {
        process.env.MAP_DATA_OUTLIER_ON_LINE_DISTANCE_M = '-1';
        expect(() => getOutlierIdentificationThresholds()).toThrow(
            /MAP_DATA_OUTLIER_ON_LINE_DISTANCE_M must be a non-negative number/,
        );
    });
});
