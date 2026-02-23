import { writeFileSync } from 'fs';
import ProgressLogger from '../../../helpers/progressLogger';
import { GeoJSONFeature, GeoJSONFeatureCollection, isAllowedGeometry, isValidFeature } from '../types/geojson';
import { getS3Geojson } from '../s3/getS3Geojson';

/**
 * Recursively expands one feature into zero or more features: returns [] if feature is invalid;
 * filters out Points; unpacks GeometryCollections (at any nesting depth) into one feature per
 * allowed sub-geometry (LineString/Polygon), with parent properties applied to each.
 */
function expandFeature(
    feature: GeoJSONFeature,
    id: string
): GeoJSONFeature[] {
    if (!isValidFeature(feature)) return [];

    const props = { ...(feature.properties ?? {}), id };
    const geom = feature.geometry!;

    if (geom.type === 'GeometryCollection') {
        const subFeatures: GeoJSONFeature[] = geom.geometries.map((sub) => {
            const subFeature: GeoJSONFeature = {
                type: 'Feature',
                geometry: sub,
                properties: { ...props },
            };
            return expandFeature(subFeature, id);
        }).flat();
        return subFeatures;
    }

    if (!isAllowedGeometry(geom)) return [];
    return [{ type: 'Feature', geometry: geom, properties: props }];
}

/**
 * Fetches the GeoJSON for one MapData id from S3 (via getS3Geojson), expands each feature
 * with expandFeature, logs progress on success or logs and returns [] on error.
 */
async function getFeaturesForId(id: string, bucket: string, logger: ProgressLogger): Promise<GeoJSONFeature[]> {
    try {
        const parsed = await getS3Geojson(bucket, id);
        const features = parsed.features
            .map((f) => expandFeature(f, id))
            .flat();
        logger.logProgress(`Processed ${id}`);
        return features;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.logError(message);
        return [];
    }
}

/**
 * Fetches each MapData GeoJSON from S3 (via getS3Geojson), expands features
 * (filters out Points, unpacks GeometryCollections), then writes a single FeatureCollection
 * to outputPath. Logs progress via ProgressLogger.
 * On getS3Geojson error (fetch or invalid GeoJSON), logs with logger.logError and continues to the next id.
 */
export async function combineTrailGeojson(ids: string[], outputPath: string, bucket: string): Promise<void> {
    const logger = new ProgressLogger('Combining trail GeoJSON', ids.length);

    const allFeatures = (await Promise.all(ids.map(id => getFeaturesForId(id, bucket, logger)))).flat();

    const geojson: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: allFeatures,
    };
    writeFileSync(outputPath, JSON.stringify(geojson), 'utf8');
    console.log(`Wrote ${allFeatures.length} trail features to ${outputPath}`);
}
