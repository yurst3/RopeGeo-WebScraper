import { readFile } from 'fs/promises';
import putS3Object from '../../helpers/s3/putS3Object';

/**
 * Builds the public URL for an object in the map data bucket.
 * When MAP_DATA_PUBLIC_BASE_URL is set (e.g. CloudFront URL), uses that so traffic goes through CloudFront.
 */
const buildMapDataPublicUrl = (bucket: string, key: string): string => {
    const base = process.env.MAP_DATA_PUBLIC_BASE_URL;
    if (base) {
        const normalized = base.replace(/\/$/, '');
        return `${normalized}/mapdata/${key}`;
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`;
};

/**
 * Uploads a file to the map data S3 bucket and returns its URL.
 * Requires DEV_ENVIRONMENT not to be "local" and MAP_DATA_BUCKET_NAME to be set before calling putS3Object.
 * When DEV_ENVIRONMENT is "local", skips uploading and logs instead, but still returns the URL that would be used.
 *
 * @param filePath - Path to the file to upload
 * @param fileKey - S3 object key (e.g. "source/id.kml" or "geojson/id.geojson")
 * @param contentType - Content-Type header value
 * @returns The URL of the uploaded (or would-be uploaded) file
 * @throws Error if MAP_DATA_BUCKET_NAME is not set
 */
const uploadMapDataToS3 = async (
    filePath: string,
    fileKey: string,
    contentType: string,
): Promise<string> => {
    const bucket = process.env.MAP_DATA_BUCKET_NAME;
    if (!bucket) {
        throw new Error('MAP_DATA_BUCKET_NAME environment variable is not set');
    }

    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log(`Skipping S3 upload - would upload ${filePath} to s3://${bucket}/${fileKey} (no bucket configured locally)`);
        return buildMapDataPublicUrl(bucket, fileKey);
    }

    const body = await readFile(filePath);
    const _ignored = await putS3Object(bucket, fileKey, body, contentType);
    return buildMapDataPublicUrl(bucket, fileKey);
};

export default uploadMapDataToS3;
