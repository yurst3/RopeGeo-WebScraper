import { writeFileSync } from 'fs';

export type TrailGeojsonInput = {
    id: string;
    geojsonBody: string;
};

type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
type GeoJSONFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

const ALLOWED_GEOMETRY_TYPES = ['LineString', 'Polygon'];

function isAllowedGeometry(geom: GeoJSON.Geometry): boolean {
    return ALLOWED_GEOMETRY_TYPES.includes(geom.type);
}

/**
 * Expands one feature into zero or more features: filters out Points, and unpacks
 * GeometryCollections into one feature per allowed sub-geometry (with parent properties).
 */
function expandFeature(
    f: GeoJSONFeature,
    id: string
): GeoJSONFeature[] {
    const props = { ...(f.properties ?? {}), id };
    const geom = f.geometry;

    if (geom.type === 'GeometryCollection') {
        const out: GeoJSONFeature[] = [];
        for (const sub of geom.geometries) {
            if (!isAllowedGeometry(sub)) continue;
            out.push({ type: 'Feature', geometry: sub, properties: { ...props } });
        }
        return out;
    }

    if (!isAllowedGeometry(geom)) return [];
    return [{ type: 'Feature', geometry: geom, properties: props }];
}

/**
 * Parses each GeoJSON body, tags every feature with id (mapDataId),
 * filters out Points, unpacks GeometryCollections into their component geometries,
 * then writes a single FeatureCollection to outputPath.
 */
export function combineTrailGeojson(inputs: TrailGeojsonInput[], outputPath: string): void {
    const allFeatures: GeoJSONFeature[] = [];

    for (const { id, geojsonBody } of inputs) {
        const parsed = JSON.parse(geojsonBody) as GeoJSONFeatureCollection;
        if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
            continue;
        }
        for (const f of parsed.features) {
            if (f.type !== 'Feature' || !f.geometry) continue;
            allFeatures.push(...expandFeature(f, id));
        }
    }

    const geojson: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: allFeatures,
    };
    writeFileSync(outputPath, JSON.stringify(geojson), 'utf8');
    console.log(`Wrote ${allFeatures.length} trail features to ${outputPath}`);
}
