import putS3Object from '../../helpers/s3/putS3Object';

const IMAGE_AVIF_CONTENT_TYPE = 'image/avif';

/**
 * Builds the public API URL for an image object in the image bucket.
 * When IMAGE_PUBLIC_BASE_URL is set (e.g. CloudFront), returns base + "/images/" + key
 * so requests go through CloudFront /images/* behavior. Otherwise returns S3 URL.
 */
export const buildImagePublicUrl = (bucket: string, key: string): string => {
    const base = process.env.IMAGE_PUBLIC_BASE_URL;
    if (base) {
        const normalized = base.replace(/\/$/, '');
        return `${normalized}/images/${key}`;
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`;
};

/**
 * Uploads a single object to the image data S3 bucket and returns its public URL.
 * Requires IMAGE_BUCKET_NAME to be set. When DEV_ENVIRONMENT is "local", putS3Object
 * skips uploading and logs instead; this function still returns the URL that would be used.
 *
 * When uploadErrors is provided and an error occurs, pushes "{key}: {message}" to it and
 * returns undefined instead of throwing (so callers can collect multiple failures).
 *
 * @param key - S3 object key (e.g. "{imageDataId}/preview.avif")
 * @param body - Object body (Buffer or Uint8Array)
 * @param contentType - Content-Type header value (default: image/avif)
 * @param uploadErrors - Optional array to collect error messages on failure (then returns undefined)
 * @returns The public URL of the uploaded (or would-be uploaded) object, or undefined on error when uploadErrors is provided
 * @throws Error if IMAGE_BUCKET_NAME is not set, or on upload failure when uploadErrors is not provided
 */
const uploadImageDataToS3 = async (
    key: string,
    body: Buffer | Uint8Array,
    contentType: string = IMAGE_AVIF_CONTENT_TYPE,
    uploadErrors?: string[],
): Promise<string | undefined> => {
    const bucket = process.env.IMAGE_BUCKET_NAME;
    if (!bucket) {
        throw new Error('IMAGE_BUCKET_NAME environment variable is not set');
    }

    try {
        await putS3Object(bucket, key, body, contentType);
        return buildImagePublicUrl(bucket, key);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (uploadErrors) {
            uploadErrors.push(`${key}: ${msg}`);
            return undefined;
        }
        throw error;
    }
};

export default uploadImageDataToS3;
