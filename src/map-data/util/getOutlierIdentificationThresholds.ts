export type OutlierIdentificationThresholds = {
    /** Classify as dense when Point count is at least this (OR points/line threshold). */
    minPointCount: number;
    /** Classify as dense when points / line count is at least this (OR point count threshold). */
    minPointsPerLine: number;
    /** On-line check: percent of sampled points within onLineDistanceM of a line. */
    minPctWithinLineM: number;
    /** Distance in meters used for the on-line sampling check. */
    onLineDistanceM: number;
    /** Non-semantic check: max(emptyName%, autoName%, trackProp%) must be at least this. */
    minNonSemanticPct: number;
};

const DEFAULTS: OutlierIdentificationThresholds = {
    minPointCount: 100,
    minPointsPerLine: 20,
    minPctWithinLineM: 90,
    onLineDistanceM: 5,
    minNonSemanticPct: 50,
};

function readNonNegativeNumberEnv(name: string, defaultValue: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') {
        return defaultValue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${name} must be a non-negative number, got: ${JSON.stringify(raw)}`);
    }
    return value;
}

/**
 * Identification thresholds for GPS track-sample outlier GeoJSONs.
 * Read from env when set; otherwise uses tuned defaults.
 *
 * - MAP_DATA_OUTLIER_MIN_POINT_COUNT (default 100)
 * - MAP_DATA_OUTLIER_MIN_POINTS_PER_LINE (default 20)
 * - MAP_DATA_OUTLIER_MIN_PCT_WITHIN_LINE_M (default 90)
 * - MAP_DATA_OUTLIER_ON_LINE_DISTANCE_M (default 5)
 * - MAP_DATA_OUTLIER_MIN_NON_SEMANTIC_PCT (default 50)
 */
export function getOutlierIdentificationThresholds(): OutlierIdentificationThresholds {
    return {
        minPointCount: readNonNegativeNumberEnv(
            'MAP_DATA_OUTLIER_MIN_POINT_COUNT',
            DEFAULTS.minPointCount,
        ),
        minPointsPerLine: readNonNegativeNumberEnv(
            'MAP_DATA_OUTLIER_MIN_POINTS_PER_LINE',
            DEFAULTS.minPointsPerLine,
        ),
        minPctWithinLineM: readNonNegativeNumberEnv(
            'MAP_DATA_OUTLIER_MIN_PCT_WITHIN_LINE_M',
            DEFAULTS.minPctWithinLineM,
        ),
        onLineDistanceM: readNonNegativeNumberEnv(
            'MAP_DATA_OUTLIER_ON_LINE_DISTANCE_M',
            DEFAULTS.onLineDistanceM,
        ),
        minNonSemanticPct: readNonNegativeNumberEnv(
            'MAP_DATA_OUTLIER_MIN_NON_SEMANTIC_PCT',
            DEFAULTS.minNonSemanticPct,
        ),
    };
}
