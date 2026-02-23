import type { Geometry } from 'geojson';
import { GeoJSONFeature, isAllowedGeometry, isValidFeature } from '../types/geojson';
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
        const subFeatures: GeoJSONFeature[] = geom.geometries.map((sub: Geometry) => {
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
 * with expandFeature (filters out Points, unpacks GeometryCollections). Throws on fetch/parse
 * error (caller should catch and log).
 */
export async function getFeaturesForGeojson(id: string, bucket: string): Promise<GeoJSONFeature[]> {
    const parsed = await getS3Geojson(bucket, id);
    const features = parsed.features
        .map((f: GeoJSONFeature) => expandFeature(f, id))
        .flat();
    return features;
}
