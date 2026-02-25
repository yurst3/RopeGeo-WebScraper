import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

/**
 * Runs Tippecanoe to convert GeoJSON file(s) in /tmp/{geojsonDir} to a directory of
 * {z}/{x}/{y}.pbf tiles under /tmp/{tilesDir}. geojsonDir/tilesDir are names; /tmp/ is prepended internally.
 * Progress is written to stderr by default and forwarded to the process so it appears in logs.
 * We do not use -X, -x, or -y so all feature properties are retained in the vector tiles.
 * Features are visible at all zoom levels: minzoom 0, no dropping (no --drop-densest-as-needed).
 */
export function makeTiles(geojsonDir: string, tilesDir: string): Promise<void> {
    const localGeojsonDir = '/tmp/' + geojsonDir;
    const localTilesDir = '/tmp/' + tilesDir;
    const geojsonFiles: string[] = (() => {
        try {
            if (statSync(localGeojsonDir).isDirectory()) {
                return readdirSync(localGeojsonDir)
                    .filter((f) => f.endsWith('.geojson'))
                    .map((f) => join(localGeojsonDir, f))
                    .sort();
            }
        } catch {
            // not a directory or missing
        }
        return [localGeojsonDir];
    })();

    if (geojsonFiles.length === 0) {
        return Promise.reject(new Error(`No .geojson files found in ${localGeojsonDir}`));
    }

    return new Promise((resolve, reject) => {
        const proc = spawn(
            'tippecanoe',
            [
                '-e', localTilesDir,
                '-l', 'trails',
                '--force',
                '-Z', '0',
                '-z', '16',
                '--detect-longitude-wraparound',
                '--use-source-polygon-winding',
                '--reverse-source-polygon-winding',
                '--no-tile-compression',
                '--no-tile-size-limit',
                ...geojsonFiles,
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
}
