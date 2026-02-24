import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
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
 * Each file is uploaded with the given contentType.
 *
 * @param inFolder - Local directory to upload (e.g. /tmp/trails-tiles)
 * @param keyPrefix - S3 key prefix (e.g. trails or routeMarkers). No trailing slash.
 * @param bucket - S3 bucket name
 * @param contentType - Content-Type header for every uploaded file
 */
export async function putS3Folder(
    inFolder: string,
    keyPrefix: string,
    bucket: string,
    contentType: string
): Promise<void> {
    const prefix = keyPrefix.replace(/\/$/, '');
    const paths = getFilePaths(inFolder);
    await Promise.all(
        paths.map(async (relPath) => {
            const body = readFileSync(join(inFolder, relPath));
            const key = `${prefix}/${relPath}`;
            await putS3Object(bucket, key, body, contentType);
        })
    );
    console.log(`Uploaded ${paths.length} file(s) to s3://${bucket}/${prefix}/`);
}
