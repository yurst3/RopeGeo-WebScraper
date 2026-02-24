import { spawn } from 'child_process';

/**
 * Runs Tippecanoe to convert a GeoJSON file at /tmp/{geojsonFile} to a directory of
 * {z}/{x}/{y}.pbf tiles under /tmp/{tilesDir}. geojsonFile/tilesDir are names; /tmp/ is prepended internally.
 * Progress is written to stderr by default and forwarded to the process so it appears in logs.
 * We do not use -X, -x, or -y so all feature properties are retained in the vector tiles.
 * Points are visible at all zoom levels: minzoom 0, -r1 so no points are dropped at low zoom.
 */
export function makeTiles(geojsonFile: string, tilesDir: string): Promise<void> {
    const localGeojsonPath = '/tmp/' + geojsonFile;
    const localTilesDir = '/tmp/' + tilesDir;
    return new Promise((resolve, reject) => {
        const proc = spawn(
            'tippecanoe',
            [
                '-e', localTilesDir,
                '-l', 'routes',
                '--force',
                '-Z', '0',
                '-zg',
                '-r1',
                '--no-tile-compression',
                localGeojsonPath,
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
