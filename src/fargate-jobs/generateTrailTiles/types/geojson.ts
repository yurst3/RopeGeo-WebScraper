export type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
export type GeoJSONFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

export const ALLOWED_GEOMETRY_TYPES: readonly string[] = ['LineString', 'Polygon'];

/**
 * Returns true if the value looks like a valid GeoJSON Feature (type is 'Feature' and geometry is present).
 */
export function isValidFeature(
    f: { type?: string; geometry?: GeoJSON.Geometry | null }
): boolean {
    return f.type === 'Feature' && f.geometry != null;
}

/**
 * Returns true if the geometry type is one we keep (LineString or Polygon).
 */
export function isAllowedGeometry(geom: GeoJSON.Geometry): boolean {
    return ALLOWED_GEOMETRY_TYPES.includes(geom.type);
}
