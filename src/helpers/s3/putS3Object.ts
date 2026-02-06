import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from './getS3Client';

/**
 * Builds the public URL for an S3 object (standard path-style format).
 */
const buildS3Url = (bucket: string, key: string): string => {
    return `https://${bucket}.s3.amazonaws.com/${key}`;
};

/**
 * Uploads an object to S3 and returns its URL.
 * If DEV_ENVIRONMENT is "local", skips uploading and logs instead, but still returns the URL that would be used.
 *
 * @param bucket - S3 bucket name
 * @param key - S3 object key
 * @param body - Object body (string, Buffer, or Uint8Array)
 * @param contentType - Content-Type header value
 * @returns The URL of the uploaded (or would-be uploaded) object
 */
const putS3Object = async (
    bucket: string,
    key: string,
    body: string | Buffer | Uint8Array,
    contentType: string,
): Promise<string> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log(`Skipping S3 put - would upload to s3://${bucket}/${key} (no bucket configured locally)`);
        return buildS3Url(bucket, key);
    }

    const s3Client = getS3Client();

    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        }),
    );

    return buildS3Url(bucket, key);
};

export default putS3Object;
