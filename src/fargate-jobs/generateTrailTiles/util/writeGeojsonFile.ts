import { writeFileSync } from 'fs';
import { join } from 'path';
import type { GeoJSONFeatureCollection } from '../types/geojson';

/**
 * Writes a GeoJSON FeatureCollection to a file in outDir named {id}.geojson.
 */
export function writeGeojsonFile(
    id: string,
    features: GeoJSONFeatureCollection['features'],
    outDir: string
): void {
    const filePath = join(outDir, `${id}.geojson`);
    const geojson: GeoJSONFeatureCollection = { type: 'FeatureCollection', features };
    writeFileSync(filePath, JSON.stringify(geojson), 'utf8');
}
