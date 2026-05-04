/**
 * Splits a FeatureCollection into point-like vs non–point-like features for separate Tippecanoe layers.
 * Features with null geometry are omitted from both outputs.
 */
export function splitGeoJsonByPointGeometry(fc: GeoJSON.FeatureCollection): {
    polyLines: GeoJSON.FeatureCollection;
    points: GeoJSON.FeatureCollection;
} {
    const pointTypes = new Set(['Point', 'MultiPoint']);
    const polyFeatures: GeoJSON.Feature[] = [];
    const pointFeatures: GeoJSON.Feature[] = [];
    for (const f of fc.features) {
        const g = f.geometry;
        if (g == null) continue;
        if (pointTypes.has(g.type)) pointFeatures.push(f);
        else polyFeatures.push(f);
    }
    return {
        polyLines: { type: 'FeatureCollection', features: polyFeatures },
        points: { type: 'FeatureCollection', features: pointFeatures },
    };
}
