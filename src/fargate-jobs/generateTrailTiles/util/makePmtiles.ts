import { spawn } from 'child_process';

/**
 * Runs Tippecanoe to convert a GeoJSON file to a .pmtiles tileset (trails layer).
 * Requires tippecanoe 2.17+ for .pmtiles output.
 */
export function makePmtiles(geojsonPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(
            'tippecanoe',
            [
                '-o', outputPath,
                '-l', 'trails',
                '--force',
                '--no-tile-compression',
                geojsonPath,
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
