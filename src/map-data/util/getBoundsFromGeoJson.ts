import type { Bounds } from '../types/mapData';

/** Mutable bounds: we update these in place so we don't need to store every coordinate. */
interface MutableBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

function updateBounds(b: MutableBounds, lon: number, lat: number): void {
    if (lat > b.north) b.north = lat;
    if (lat < b.south) b.south = lat;
    if (lon > b.east) b.east = lon;
    if (lon < b.west) b.west = lon;
}

/**
 * Updates the mutable bounds with all [lon, lat] positions from a single geometry.
 * Recursively handles GeometryCollection.
 */
function collectCoordinates(geometry: GeoJSON.Geometry, bounds: MutableBounds): void {
    switch (geometry.type) {
        case 'Point':
            updateBounds(bounds, geometry.coordinates[0]!, geometry.coordinates[1]!);
            return;
        case 'LineString':
            for (const c of geometry.coordinates) {
                updateBounds(bounds, c[0]!, c[1]!);
            }
            return;
        case 'Polygon':
            for (const ring of geometry.coordinates) {
                for (const c of ring) {
                    updateBounds(bounds, c[0]!, c[1]!);
                }
            }
            return;
        case 'MultiPoint':
            for (const c of geometry.coordinates) {
                updateBounds(bounds, c[0]!, c[1]!);
            }
            return;
        case 'MultiLineString':
            for (const line of geometry.coordinates) {
                for (const c of line) {
                    updateBounds(bounds, c[0]!, c[1]!);
                }
            }
            return;
        case 'MultiPolygon':
            for (const polygon of geometry.coordinates) {
                for (const ring of polygon) {
                    for (const c of ring) {
                        updateBounds(bounds, c[0]!, c[1]!);
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

    const bounds: MutableBounds = {
        north: -Infinity,
        south: Infinity,
        east: -Infinity,
        west: Infinity,
    };

    for (const feature of geoJson.features) {
        const geom = feature.geometry;
        if (geom) {
            collectCoordinates(geom, bounds);
        }
    }

    if (!Number.isFinite(bounds.north) || !Number.isFinite(bounds.south)) {
        return null;
    }

    return { north: bounds.north, south: bounds.south, east: bounds.east, west: bounds.west };
}
