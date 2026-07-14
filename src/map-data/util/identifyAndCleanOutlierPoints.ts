import { writeFile } from 'fs/promises';
import type { ProgressLogger } from 'ropegeo-common/helpers';
import { maybeCleanOutlierGeoJson } from './outlierTrackPoints';

/**
 * Identify GPS track-sample outlier GeoJSON and, when matched, write a cleaned FeatureCollection
 * (non-semantic points removed) back to disk.
 *
 * @returns The cleaned FeatureCollection when cleaning ran; otherwise the original.
 */
export async function identifyAndCleanOutlierPoints(
    geojson: GeoJSON.FeatureCollection,
    geoJsonFilePath: string,
    mapDataId: string,
    logger: ProgressLogger,
): Promise<GeoJSON.FeatureCollection> {
    const outlierResult = maybeCleanOutlierGeoJson(geojson);
    if (!outlierResult.cleaned || outlierResult.cleanResult == null) {
        return geojson;
    }

    await writeFile(geoJsonFilePath, JSON.stringify(outlierResult.geojson), 'utf-8');
    logger.logProgress(
        `Cleaned outlier GeoJSON for ${mapDataId}: removed ${outlierResult.cleanResult.removedPointCount} non-semantic points (${outlierResult.cleanResult.originalFeatureCount}→${outlierResult.cleanResult.keptFeatureCount} features)`,
    );
    return outlierResult.geojson;
}
