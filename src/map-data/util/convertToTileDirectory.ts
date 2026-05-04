import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import {
    PAGE_MINIMAP_POINT_LAYER_ID,
    PAGE_MINIMAP_POLYLINE_LAYER_ID,
} from '../../constants/pageMinimapMvtLayerIds';
import { splitGeoJsonByPointGeometry } from './splitGeoJsonByPointGeometry';

/**
 * Converts a single GeoJSON file to a directory of {z}/{x}/{y}.pbf tiles using Tippecanoe.
 * Point/MultiPoint features go to layer {@link PAGE_MINIMAP_POINT_LAYER_ID}; all other geometries
 * go to {@link PAGE_MINIMAP_POLYLINE_LAYER_ID}. The full GeoJSON on disk is unchanged; filtered
 * copies drive parallel Tippecanoe runs, then tile-join merges into one tile tree.
 *
 * Min zoom 0, max zoom 20; shared options include no tile compression/size limit, polygon winding,
 * and `--no-feature-limit`. The **Points** layer run also uses `-r1`, `--no-clipping`, and
 * `--no-duplication`; the **PolyLines** run does not.
 *
 * @param geoJsonFilePath - Path to the GeoJSON file (all features; not modified)
 * @param outputDir - Full path to the output directory (e.g. /tmp/map-data-xxx/tiles)
 * @param _mapDataId - Reserved for callers (API unchanged); layer names are fixed MVT ids, not this uuid.
 * @returns Promise that resolves to { tilesDir } on success or { error } on failure
 */
export async function convertToTileDirectory(
    geoJsonFilePath: string,
    outputDir: string,
    _mapDataId: string,
): Promise<{ tilesDir: string } | { error: string }> {
    const tippecanoePath = process.env.LAMBDA_TASK_ROOT
        ? join(process.env.LAMBDA_TASK_ROOT, 'tippecanoe')
        : 'tippecanoe';
    const tileJoinPath = process.env.LAMBDA_TASK_ROOT
        ? join(process.env.LAMBDA_TASK_ROOT, 'tile-join')
        : 'tile-join';

    const tippecanoeSharedArgs = [
        '--force',
        '-Z',
        '0',
        '-z',
        '20',
        '--detect-longitude-wraparound',
        '--use-source-polygon-winding',
        '--reverse-source-polygon-winding',
        '--no-tile-compression',
        '--no-tile-size-limit',
        '--no-feature-limit',
    ];

    /** Extra Tippecanoe flags for point tiles only (not used for PolyLines). */
    const tippecanoePointsLayerArgs = ['-r1', '--no-clipping', '--no-duplication'];

    const runSpawn = async (command: string, args: string[]): Promise<void> => {
        await new Promise<void>((resolve, reject) => {
            const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';
            proc.stderr?.on('data', (chunk) => {
                stderr += chunk;
                process.stderr.write(chunk);
            });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`${command} exited ${code}: ${stderr}`));
            });
            proc.on('error', (err) => reject(err));
        });
    };

    try {
        const geoJsonContent = await readFile(geoJsonFilePath, 'utf-8');
        const geoJson = JSON.parse(geoJsonContent) as GeoJSON.FeatureCollection;

        if (geoJson.type === 'FeatureCollection' && (!geoJson.features || geoJson.features.length === 0)) {
            console.error('GeoJSON has no features, skipping tile directory conversion');
            return { error: 'Failed to convert to tiles: GeoJSON has no features' };
        }

        const { polyLines, points } = splitGeoJsonByPointGeometry(geoJson);

        if (polyLines.features.length === 0 && points.features.length === 0) {
            console.error('GeoJSON has no usable geometries after split, skipping tile directory conversion');
            return { error: 'Failed to convert to tiles: GeoJSON has no features' };
        }

        const workDir = await mkdtemp(join(tmpdir(), 'tippecanoe-'));
        try {
            const mbtilesPaths: string[] = [];

            const polyPath = join(workDir, 'poly.geojson');
            const pointsPath = join(workDir, 'points.geojson');
            const polyMbtiles = join(workDir, 'poly.mbtiles');
            const pointsMbtiles = join(workDir, 'points.mbtiles');

            const tippecanoeTasks: Promise<void>[] = [];

            if (polyLines.features.length > 0) {
                await writeFile(polyPath, JSON.stringify(polyLines), 'utf-8');
                tippecanoeTasks.push(
                    runSpawn(tippecanoePath, [
                        '-o',
                        polyMbtiles,
                        '-l',
                        PAGE_MINIMAP_POLYLINE_LAYER_ID,
                        ...tippecanoeSharedArgs,
                        polyPath,
                    ]),
                );
                mbtilesPaths.push(polyMbtiles);
            }

            if (points.features.length > 0) {
                await writeFile(pointsPath, JSON.stringify(points), 'utf-8');
                tippecanoeTasks.push(
                    runSpawn(tippecanoePath, [
                        '-o',
                        pointsMbtiles,
                        '-l',
                        PAGE_MINIMAP_POINT_LAYER_ID,
                        ...tippecanoeSharedArgs,
                        ...tippecanoePointsLayerArgs,
                        pointsPath,
                    ]),
                );
                mbtilesPaths.push(pointsMbtiles);
            }

            await Promise.all(tippecanoeTasks);

            await runSpawn(tileJoinPath, [
                '-e',
                outputDir,
                '-f',
                '-pk',
                '-pC',
                ...mbtilesPaths,
            ]);
        } finally {
            await rm(workDir, { recursive: true, force: true });
        }

        return { tilesDir: outputDir };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { error: `Failed to convert to tiles: ${errorMessage}` };
    }
}
