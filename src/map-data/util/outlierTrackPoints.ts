import {
    getOutlierIdentificationThresholds,
    type OutlierIdentificationThresholds,
} from './getOutlierIdentificationThresholds';

type Position = [number, number];

type LineStringGeometry = { type: 'LineString'; coordinates: number[][] };
type MultiLineStringGeometry = { type: 'MultiLineString'; coordinates: number[][][] };
type LineGeometry = LineStringGeometry | MultiLineStringGeometry;

export type OutlierHeuristicMetrics = {
    pointCount: number;
    lineCount: number;
    lineVertexCount: number;
    pointsPerLine: number;
    pointsVsVerticesRatio: number;
    pctWithinLineM: number;
    emptyNamePct: number;
    autoNamePct: number;
    trackPropPct: number;
    classifiedAsOutlier: boolean;
    reasons: string[];
    thresholds: OutlierIdentificationThresholds;
};

export type CleanOutlierGeoJsonResult = {
    geojson: GeoJSON.FeatureCollection;
    originalFeatureCount: number;
    keptFeatureCount: number;
    removedPointCount: number;
    keptPointCount: number;
};

const TRACK_PROP_KEYS = new Set([
    'time',
    'timespan',
    'timestamp',
    'ele',
    'track_seg_point_id',
    'track_seg_id',
    'track_fid',
    'ns3_TrackPointExtension',
]);

const AUTO_NAME_RE = /^(wpt)?\d+$/i;

function featureName(props: GeoJSON.GeoJsonProperties): string {
    if (props == null || typeof props !== 'object' || Array.isArray(props)) {
        return '';
    }
    const raw = (props as Record<string, unknown>).name ?? (props as Record<string, unknown>).Name;
    return typeof raw === 'string' ? raw.trim() : '';
}

function isAutoName(name: string): boolean {
    return AUTO_NAME_RE.test(name);
}

function hasTrackProps(props: GeoJSON.GeoJsonProperties): boolean {
    if (props == null || typeof props !== 'object' || Array.isArray(props)) {
        return false;
    }
    return Object.keys(props).some((key) => TRACK_PROP_KEYS.has(key));
}

/** Empty or auto-generated names (001, WPT006, etc.). */
export function isNonSemanticPoint(props: GeoJSON.GeoJsonProperties): boolean {
    const name = featureName(props);
    if (name.length === 0) return true;
    if (isAutoName(name)) return true;
    return false;
}

function lineSegments(geometry: LineGeometry): Array<[number, number, number, number]> {
    const segs: Array<[number, number, number, number]> = [];
    if (geometry.type === 'LineString') {
        const coords = geometry.coordinates;
        for (let i = 0; i < coords.length - 1; i++) {
            const a = coords[i]!;
            const b = coords[i + 1]!;
            segs.push([a[0]!, a[1]!, b[0]!, b[1]!]);
        }
    } else {
        for (const part of geometry.coordinates) {
            for (let i = 0; i < part.length - 1; i++) {
                const a = part[i]!;
                const b = part[i + 1]!;
                segs.push([a[0]!, a[1]!, b[0]!, b[1]!]);
            }
        }
    }
    return segs;
}

function countLineVertices(geometry: LineGeometry): number {
    if (geometry.type === 'LineString') {
        return geometry.coordinates.length;
    }
    return geometry.coordinates.reduce((sum: number, part: number[][]) => sum + part.length, 0);
}

/** Approximate point-to-segment distance in meters (equirectangular). */
function distPointToSegmentMeters(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
): number {
    const lat = (py + ay + by) / 3;
    const mx = 111_320 * Math.cos((lat * Math.PI) / 180);
    const my = 110_540;
    const pxm = px * mx;
    const pym = py * my;
    const axm = ax * mx;
    const aym = ay * my;
    const bxm = bx * mx;
    const bym = by * my;
    const abx = bxm - axm;
    const aby = bym - aym;
    const apx = pxm - axm;
    const apy = pym - aym;
    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) {
        return Math.hypot(apx, apy);
    }
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
    return Math.hypot(pxm - (axm + t * abx), pym - (aym + t * aby));
}

function minDistToLinesMeters(
    lon: number,
    lat: number,
    segs: Array<[number, number, number, number]>,
): number {
    let best = Number.POSITIVE_INFINITY;
    const step = Math.max(1, Math.floor(segs.length / 2000));
    for (let i = 0; i < segs.length; i += step) {
        const [ax, ay, bx, by] = segs[i]!;
        const d = distPointToSegmentMeters(lon, lat, ax, ay, bx, by);
        if (d < best) best = d;
    }
    return best;
}

function pct(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return Math.round((1000 * numerator) / denominator) / 10;
}

function collectLineGeometries(geojson: GeoJSON.FeatureCollection): LineGeometry[] {
    const lineGeoms: LineGeometry[] = [];
    for (const feature of geojson.features) {
        const geometry = feature.geometry;
        if (geometry == null) continue;
        if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
            lineGeoms.push(geometry as LineGeometry);
        }
    }
    return lineGeoms;
}

function pointPosition(geometry: GeoJSON.Geometry | null): Position | null {
    if (geometry == null || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
        return null;
    }
    const lon = geometry.coordinates[0];
    const lat = geometry.coordinates[1];
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;
    return [lon, lat];
}

/**
 * Identify GPS-track-sample point outliers:
 * dense points that hug line geometries and lack semantic waypoint names.
 */
export function analyzeGeoJsonForTrackPointOutliers(
    geojson: GeoJSON.FeatureCollection,
    thresholds: OutlierIdentificationThresholds = getOutlierIdentificationThresholds(),
): OutlierHeuristicMetrics {
    const points: Array<{ position: Position; props: GeoJSON.GeoJsonProperties }> = [];
    const lineGeoms = collectLineGeometries(geojson);

    for (const feature of geojson.features) {
        const position = pointPosition(feature.geometry);
        if (position != null) {
            points.push({ position, props: feature.properties });
        }
    }

    const segs = lineGeoms.flatMap(lineSegments);
    const lineVertexCountTotal = lineGeoms.reduce((sum, g) => sum + countLineVertices(g), 0);
    const pointCount = points.length;
    const lineCount = lineGeoms.length;
    const pointsPerLine = pointCount / Math.max(lineCount, 1);
    const pointsVsVerticesRatio =
        Math.round((100 * pointCount) / Math.max(lineVertexCountTotal, 1)) / 100;

    let withinLineM = 0;
    let emptyName = 0;
    let autoName = 0;
    let trackProp = 0;

    // Cap distance checks for huge files while keeping a representative sample.
    const sampleStep = Math.max(1, Math.floor(pointCount / 500));
    let sampled = 0;
    for (let i = 0; i < points.length; i++) {
        const point = points[i]!;
        const name = featureName(point.props);
        if (name.length === 0) emptyName += 1;
        else if (isAutoName(name)) autoName += 1;
        if (hasTrackProps(point.props)) trackProp += 1;

        if (i % sampleStep === 0 && segs.length > 0) {
            sampled += 1;
            if (
                minDistToLinesMeters(point.position[0], point.position[1], segs) <=
                thresholds.onLineDistanceM
            ) {
                withinLineM += 1;
            }
        }
    }

    const pctWithinLineM = pct(withinLineM, sampled);
    const emptyNamePct = pct(emptyName, pointCount);
    const autoNamePct = pct(autoName, pointCount);
    const trackPropPct = pct(trackProp, pointCount);
    const nonSemanticPct = Math.max(emptyNamePct, autoNamePct, trackPropPct);

    const densityHit =
        pointCount >= thresholds.minPointCount || pointsPerLine >= thresholds.minPointsPerLine;
    const onLineHit = pctWithinLineM >= thresholds.minPctWithinLineM;
    const nonSemanticHit = nonSemanticPct >= thresholds.minNonSemanticPct;

    const reasons: string[] = [];
    if (densityHit) {
        reasons.push(
            `density (points=${pointCount}, points/line=${pointsPerLine.toFixed(1)})`,
        );
    }
    if (onLineHit) {
        reasons.push(`on-line (${pctWithinLineM}% within ${thresholds.onLineDistanceM}m)`);
    }
    if (nonSemanticHit) {
        reasons.push(
            `non-semantic (emptyName=${emptyNamePct}%, autoName=${autoNamePct}%, trackProps=${trackPropPct}%)`,
        );
    }

    return {
        pointCount,
        lineCount,
        lineVertexCount: lineVertexCountTotal,
        pointsPerLine: Math.round(pointsPerLine * 10) / 10,
        pointsVsVerticesRatio,
        pctWithinLineM,
        emptyNamePct,
        autoNamePct,
        trackPropPct,
        classifiedAsOutlier: densityHit && onLineHit && nonSemanticHit,
        reasons,
        thresholds,
    };
}

/**
 * Drop non-semantic Point features (empty / auto-generated names).
 * Keeps lines/polygons and semantic named waypoints (Start, Parking, rappels, etc.).
 */
export function cleanNonSemanticTrackPoints(
    geojson: GeoJSON.FeatureCollection,
): CleanOutlierGeoJsonResult {
    let removedPointCount = 0;
    let keptPointCount = 0;
    const keptFeatures: GeoJSON.Feature[] = [];

    for (const feature of geojson.features) {
        const position = pointPosition(feature.geometry);
        if (position == null) {
            keptFeatures.push(feature);
            continue;
        }

        if (isNonSemanticPoint(feature.properties)) {
            removedPointCount += 1;
            continue;
        }

        keptPointCount += 1;
        keptFeatures.push(feature);
    }

    const { features: _ignored, ...rest } = geojson;
    return {
        geojson: {
            ...rest,
            type: 'FeatureCollection',
            features: keptFeatures,
        },
        originalFeatureCount: geojson.features.length,
        keptFeatureCount: keptFeatures.length,
        removedPointCount,
        keptPointCount,
    };
}

/**
 * If GeoJSON matches outlier heuristics, remove non-semantic track-sample points.
 * Returns the (possibly cleaned) FeatureCollection and optional cleanup stats.
 */
export function maybeCleanOutlierGeoJson(
    geojson: GeoJSON.FeatureCollection,
    thresholds: OutlierIdentificationThresholds = getOutlierIdentificationThresholds(),
): {
    geojson: GeoJSON.FeatureCollection;
    cleaned: boolean;
    metrics: OutlierHeuristicMetrics;
    cleanResult?: CleanOutlierGeoJsonResult;
} {
    const metrics = analyzeGeoJsonForTrackPointOutliers(geojson, thresholds);
    if (!metrics.classifiedAsOutlier) {
        return { geojson, cleaned: false, metrics };
    }
    const cleanResult = cleanNonSemanticTrackPoints(geojson);
    return {
        geojson: cleanResult.geojson,
        cleaned: true,
        metrics,
        cleanResult,
    };
}
