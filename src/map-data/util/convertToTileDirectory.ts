import { readFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

/**
 * Converts a single GeoJSON file to a directory of {z}/{x}/{y}.pbf tiles using Tippecanoe.
 * Layer name = mapDataId, min zoom 0, max zoom 20. Also: `-r1` (no fractional point drop by zoom),
 * `--no-clipping` (features not clipped to tile bounds), `--no-feature-limit`, no tile size limit,
 * no tile compression — for consistent point/line presence in page minimap tiles.
 *
 * @param geoJsonFilePath - Path to the GeoJSON file
 * @param outputDir - Full path to the output directory (e.g. /tmp/map-data-xxx/tiles)
 * @param mapDataId - UUID for the map data (used as layer name)
 * @returns Promise that resolves to { tilesDir } on success or { error } on failure
 */
export async function convertToTileDirectory(
    geoJsonFilePath: string,
    outputDir: string,
    mapDataId: string,
): Promise<{ tilesDir: string } | { error: string }> {
    try {
        const geoJsonContent = await readFile(geoJsonFilePath, 'utf-8');
        const geoJson = JSON.parse(geoJsonContent);

        if (geoJson.type === 'FeatureCollection' && (!geoJson.features || geoJson.features.length === 0)) {
            console.error('GeoJSON has no features, skipping tile directory conversion');
            return { error: 'Failed to convert to tiles: GeoJSON has no features' };
        }

        const tippecanoePath = process.env.LAMBDA_TASK_ROOT
            ? join(process.env.LAMBDA_TASK_ROOT, 'tippecanoe')
            : 'tippecanoe';

        await new Promise<void>((resolve, reject) => {
            const proc = spawn(
                tippecanoePath,
                [
                    '-e',
                    outputDir,
                    '-l',
                    mapDataId,
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
                    '-r1',
                    '--no-clipping',
                    '--no-feature-limit',
                    geoJsonFilePath,
                ],
                { stdio: ['ignore', 'pipe', 'pipe'] }
            );
            let stderr = '';
            proc.stderr?.on('data', (chunk) => {
                stderr += chunk;
                process.stderr.write(chunk);
            });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`tippecanoe exited ${code}: ${stderr}`));
            });
            proc.on('error', (err) => reject(err));
        });

        return { tilesDir: outputDir };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { error: `Failed to convert to tiles: ${errorMessage}` };
    }
}
