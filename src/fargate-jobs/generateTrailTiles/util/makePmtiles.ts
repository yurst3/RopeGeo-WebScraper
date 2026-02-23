import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

/**
 * Runs Tippecanoe to convert GeoJSON file(s) in inputPath to a single .pmtiles tileset (trails layer).
 * inputPath can be a directory (all .geojson files inside) or a single .geojson file path.
 * Requires tippecanoe 2.17+ for .pmtiles output.
 */
export function makePmtiles(inputPath: string, outputPath: string): Promise<void> {
    const geojsonFiles: string[] = (() => {
        try {
            if (statSync(inputPath).isDirectory()) {
                return readdirSync(inputPath)
                    .filter((f) => f.endsWith('.geojson'))
                    .map((f) => join(inputPath, f))
                    .sort();
            }
        } catch {
            // not a directory or missing
        }
        return [inputPath];
    })();

    if (geojsonFiles.length === 0) {
        return Promise.reject(new Error(`No .geojson files found in ${inputPath}`));
    }

    return new Promise((resolve, reject) => {
        const proc = spawn(
            'tippecanoe',
            [
                '-o', outputPath,
                '-l', 'trails',
                '--force',
                '--maximum-zoom=g',
                '--detect-longitude-wraparound',
                '--use-source-polygon-winding',
                '--reverse-source-polygon-winding',
                '--drop-densest-as-needed',
                '--extend-zooms-if-still-dropping',
                '--no-tile-compression',
                '--no-tile-size-limit',
                ...geojsonFiles,
            ],
            { stdio: ['ignore', 'pipe', 'pipe'] }
        );
        let stderr = '';
        proc.stderr?.on('data', (chunk) => { stderr += chunk; });
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`tippecanoe exited ${code}: ${stderr}`));
        });
        proc.on('error', (err) => reject(err));
    });
}
