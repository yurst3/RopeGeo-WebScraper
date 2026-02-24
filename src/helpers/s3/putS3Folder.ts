import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import ProgressLogger from '../progressLogger';
import putS3Object from './putS3Object';

function getFilePaths(dir: string, baseDir: string = dir): string[] {
    const results: string[] = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = join(dir, e.name);
        const rel = relative(baseDir, full);
        if (e.isDirectory()) {
            results.push(...getFilePaths(full, baseDir));
        } else {
            results.push(rel);
        }
    }
    return results;
}

/**
 * Uploads all files from inFolder to S3 under keyPrefix, preserving directory structure.
 * Each file is uploaded with the given contentType. Logs progress and errors via ProgressLogger.
 *
 * @param inFolder - Local directory to upload (e.g. /tmp/trails-tiles)
 * @param keyPrefix - S3 key prefix (e.g. trails or routeMarkers). No trailing slash.
 * @param bucket - S3 bucket name
 * @param contentType - Content-Type header for every uploaded file
 * @returns Array of all S3 keys that correspond to the local files (whether or not each upload succeeded).
 *          Used by replaceS3Folder so we only delete existing keys not in this set—failed overwrites are not removed.
 */
export async function putS3Folder(
    inFolder: string,
    keyPrefix: string,
    bucket: string,
    contentType: string
): Promise<string[]> {
    const prefix = keyPrefix.replace(/\/$/, '');
    const paths = getFilePaths(inFolder);
    const logger = new ProgressLogger('Uploading to S3', paths.length);

    await Promise.all(
        paths.map(async (relPath) => {
            try {
                const body = readFileSync(join(inFolder, relPath));
                const key = `${prefix}/${relPath}`;
                await putS3Object(bucket, key, body, contentType);
                logger.logProgress(relPath);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger.logError(`${relPath}: ${message}`);
            }
        })
    );

    const { successes, errors } = logger.getResults();
    console.log(`Upload complete: ${successes} success(es), ${errors} error(s) to s3://${bucket}/${prefix}/`);
    return paths.map((relPath) => `${prefix}/${relPath}`);
}
