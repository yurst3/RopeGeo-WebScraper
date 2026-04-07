import { Bounds } from 'ropegeo-common/models';

/**
 * Updates the bounds with all [lon, lat] positions from a single geometry.
 * Recursively handles GeometryCollection.
 */
function collectCoordinates(geometry: GeoJSON.Geometry, bounds: Bounds): void {
    switch (geometry.type) {
        case 'Point':
            bounds.update(geometry.coordinates[0]!, geometry.coordinates[1]!);
            return;
        case 'LineString':
            for (const c of geometry.coordinates) {
                bounds.update(c[0]!, c[1]!);
            }
            return;
        case 'Polygon':
            for (const ring of geometry.coordinates) {
                for (const c of ring) {
                    bounds.update(c[0]!, c[1]!);
                }
            }
            return;
        case 'MultiPoint':
            for (const c of geometry.coordinates) {
                bounds.update(c[0]!, c[1]!);
            }
            return;
        case 'MultiLineString':
            for (const line of geometry.coordinates) {
                for (const c of line) {
                    bounds.update(c[0]!, c[1]!);
                }
            }
            return;
        case 'MultiPolygon':
            for (const polygon of geometry.coordinates) {
                for (const ring of polygon) {
                    for (const c of ring) {
                        bounds.update(c[0]!, c[1]!);
                    }
                }
            }
            return;
        case 'GeometryCollection':
            for (const sub of geometry.geometries) {
                collectCoordinates(sub, bounds);
            }
            return;
        default:
            return;
    }
}

/**
 * Walks the FeatureCollection's features and all geometries (including nested
 * GeometryCollections), tracks min/max lat/lon, and returns a Bounds object
 * or null if there are no features or no coordinates.
 */
export function getBoundsFromGeoJson(geoJson: GeoJSON.FeatureCollection): Bounds | null {
    if (!geoJson.features || geoJson.features.length === 0) {
        return null;
    }

    const bounds = new Bounds(-Infinity, Infinity, -Infinity, Infinity);

    for (const feature of geoJson.features) {
        const geom = feature.geometry;
        if (geom) {
            collectCoordinates(geom, bounds);
        }
    }

    if (!Number.isFinite(bounds.north) || !Number.isFinite(bounds.south)) {
        return null;
    }

    return bounds;
}
