import { randomUUID } from 'crypto';
import type { LegendItem } from 'ropegeo-common/models';
import { LineLegendItem, PointLegendItem, PolygonLegendItem } from 'ropegeo-common/models';
import { getBoundsFromGeometry } from './getBoundsFromGeoJson';

/** Property on each legend-backed feature; matches {@link LegendItem.id} (UUID v4). */
export const LEGEND_ID_PROPERTY = 'legendId';

function readStringProp(
    props: GeoJSON.GeoJsonProperties,
    keys: string[],
): string | undefined {
    if (props == null || typeof props !== 'object' || Array.isArray(props)) {
        return undefined;
    }
    const o = props as Record<string, unknown>;
    for (const key of keys) {
        const v = o[key];
        if (typeof v === 'string') {
            const t = v.trim();
            if (t.length > 0) return t;
        }
    }
    return undefined;
}

function featureLabel(props: GeoJSON.GeoJsonProperties, fallback: string): string {
    return (
        readStringProp(props, ['name', 'Name', 'title', 'Title', 'description', 'Description']) ??
        fallback
    );
}

function strokeColorFromProps(props: GeoJSON.GeoJsonProperties): string | undefined {
    return readStringProp(props, [
        'stroke',
        'strokeColor',
        'stroke-color',
        'color',
        'line-color',
        'lineColor',
    ]);
}

function strokeWidthFromProps(props: GeoJSON.GeoJsonProperties): string | undefined {
    const w = readStringProp(props, ['stroke-width', 'strokeWidth', 'weight']);
    return w;
}

function borderColorFromProps(props: GeoJSON.GeoJsonProperties): string | undefined {
    return readStringProp(props, ['stroke', 'strokeColor', 'stroke-color', 'borderColor', 'border-color']);
}

function fillColorFromProps(props: GeoJSON.GeoJsonProperties): string | undefined {
    return readStringProp(props, ['fill', 'fillColor', 'fill-color', 'color']);
}

function mergedLegendProperties(
    base: GeoJSON.GeoJsonProperties,
    legendId: string,
): GeoJSON.GeoJsonProperties {
    const o =
        base != null && typeof base === 'object' && !Array.isArray(base)
            ? { ...(base as Record<string, unknown>) }
            : {};
    o[LEGEND_ID_PROPERTY] = legendId;
    return o as GeoJSON.GeoJsonProperties;
}

function pushFeature(
    outFeatures: GeoJSON.Feature[],
    props: GeoJSON.GeoJsonProperties,
    geometry: GeoJSON.Geometry,
): void {
    outFeatures.push({
        type: 'Feature',
        properties: props,
        geometry,
    });
}

export type EnrichGeoJsonWithLegendIdsResult = {
    geoJson: GeoJSON.FeatureCollection;
    legend: Record<string, LegendItem> | undefined;
};

/**
 * Assigns stable legend UUIDs on GeoJSON features, builds the parallel MapData `legend` map, and
 * **explodes** MultiPoint / MultiLineString / MultiPolygon into simple geometries so each legend row
 * matches one tile feature. Writes should use the returned `geoJson` before running Tippecanoe.
 */
export function enrichGeoJsonWithLegendIds(
    geoJson: GeoJSON.FeatureCollection,
): EnrichGeoJsonWithLegendIdsResult {
    const out: Record<string, LegendItem> = {};
    const outFeatures: GeoJSON.Feature[] = [];
    let index = 0;

    for (const feature of geoJson.features ?? []) {
        const geom = feature.geometry;
        if (geom == null) {
            outFeatures.push({ ...feature } as GeoJSON.Feature);
            index += 1;
            continue;
        }
        const props = feature.properties;

        switch (geom.type) {
            case 'Point': {
                const lon = geom.coordinates[0]!;
                const lat = geom.coordinates[1]!;
                if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
                    outFeatures.push({ ...feature });
                    break;
                }
                const id = randomUUID();
                const p = mergedLegendProperties(props, id);
                const icon = readStringProp(props, ['icon', 'marker-symbol', 'markerSymbol']);
                out[id] = new PointLegendItem(id, featureLabel(props, `Point ${index + 1}`), { lat, lon }, icon);
                pushFeature(outFeatures, p, geom);
                break;
            }
            case 'MultiPoint': {
                for (const c of geom.coordinates) {
                    const lon = c[0];
                    const lat = c[1];
                    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
                    const id = randomUUID();
                    const p = mergedLegendProperties(props, id);
                    const icon = readStringProp(props, ['icon', 'marker-symbol', 'markerSymbol']);
                    out[id] = new PointLegendItem(
                        id,
                        featureLabel(props, `Point ${index + 1}`),
                        { lat: lat!, lon: lon! },
                        icon,
                    );
                    pushFeature(outFeatures, p, { type: 'Point', coordinates: [lon!, lat!] });
                }
                break;
            }
            case 'LineString': {
                const b = getBoundsFromGeometry(geom);
                if (b == null) {
                    outFeatures.push({ ...feature });
                    break;
                }
                const id = randomUUID();
                const p = mergedLegendProperties(props, id);
                out[id] = new LineLegendItem(
                    id,
                    featureLabel(props, `Line ${index + 1}`),
                    b,
                    strokeColorFromProps(props),
                    strokeWidthFromProps(props),
                );
                pushFeature(outFeatures, p, geom);
                break;
            }
            case 'MultiLineString': {
                let part = 0;
                for (const line of geom.coordinates) {
                    const b = getBoundsFromGeometry({ type: 'LineString', coordinates: line });
                    if (b == null) continue;
                    const id = randomUUID();
                    const p = mergedLegendProperties(props, id);
                    out[id] = new LineLegendItem(
                        id,
                        featureLabel(props, `Line ${index + 1} (${part + 1})`),
                        b,
                        strokeColorFromProps(props),
                        strokeWidthFromProps(props),
                    );
                    pushFeature(outFeatures, p, { type: 'LineString', coordinates: line });
                    part += 1;
                }
                break;
            }
            case 'Polygon': {
                const b = getBoundsFromGeometry(geom);
                if (b == null) {
                    outFeatures.push({ ...feature });
                    break;
                }
                const id = randomUUID();
                const p = mergedLegendProperties(props, id);
                out[id] = new PolygonLegendItem(
                    id,
                    featureLabel(props, `Area ${index + 1}`),
                    b,
                    borderColorFromProps(props),
                    fillColorFromProps(props),
                );
                pushFeature(outFeatures, p, geom);
                break;
            }
            case 'MultiPolygon': {
                let part = 0;
                for (const poly of geom.coordinates) {
                    const b = getBoundsFromGeometry({ type: 'Polygon', coordinates: poly });
                    if (b == null) continue;
                    const id = randomUUID();
                    const p = mergedLegendProperties(props, id);
                    out[id] = new PolygonLegendItem(
                        id,
                        featureLabel(props, `Area ${index + 1} (${part + 1})`),
                        b,
                        borderColorFromProps(props),
                        fillColorFromProps(props),
                    );
                    pushFeature(outFeatures, p, { type: 'Polygon', coordinates: poly });
                    part += 1;
                }
                break;
            }
            default:
                outFeatures.push({ ...feature });
                break;
        }
        index += 1;
    }

    return {
        geoJson: { type: 'FeatureCollection', features: outFeatures },
        legend: Object.keys(out).length > 0 ? out : undefined,
    };
}

/**
 * @deprecated Prefer {@link enrichGeoJsonWithLegendIds} so GeoJSON is enriched before tiling.
 * Returns only the legend map (does not mutate GeoJSON).
 */
export function buildLegendFromGeoJson(
    geoJson: GeoJSON.FeatureCollection,
): Record<string, LegendItem> | undefined {
    return enrichGeoJsonWithLegendIds(geoJson).legend;
}
