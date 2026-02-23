import { writeFileSync } from 'fs';
import type * as s from 'zapatos/schema';
import { Route } from '../../../types/route';

/**
 * Builds a GeoJSON FeatureCollection of route points and writes it to outputPath.
 */
export function makeGeojson(routes: s.Route.JSONSelectable[], outputPath: string): void {
    const features = routes.map((row) => Route.fromDbRow(row).toGeoJsonFeature());
    const geojson = {
        type: 'FeatureCollection' as const,
        features,
    };
    writeFileSync(outputPath, JSON.stringify(geojson), 'utf8');
    console.log(`Wrote ${features.length} route points to ${outputPath}`);
}
