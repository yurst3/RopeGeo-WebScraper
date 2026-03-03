import getS3Object from '../../../helpers/s3/getS3Object';
import type { GeoJSONFeatureCollection } from '../types/geojson';

/**
 * Fetches the GeoJSON for a MapData id from S3 (geojson/{id}.geojson), parses it,
 * and validates that it is a FeatureCollection with a features array. Throws if not.
 */
export async function getS3Geojson(bucket: string, id: string): Promise<GeoJSONFeatureCollection> {
    const { body } = await getS3Object(bucket, `geojson/${id}.geojson`);
    const parsed = JSON.parse(body) as unknown;
    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        (parsed as { type?: string }).type !== 'FeatureCollection' ||
        !Array.isArray((parsed as { features?: unknown }).features)
    ) {
        throw new Error(
            `MapData ${id}: expected a GeoJSON FeatureCollection with a features array, got ${typeof parsed === 'object' && parsed !== null ? (parsed as { type?: string }).type : typeof parsed}`
        );
    }
    return parsed as GeoJSONFeatureCollection;
}
