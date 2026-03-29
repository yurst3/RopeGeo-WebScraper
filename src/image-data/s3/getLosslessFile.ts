import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from 'ropegeo-common/helpers/s3/getS3Client';

function isNoSuchKeyError(err: unknown): boolean {
    return err instanceof Error && (err as Error & { name?: string }).name === 'NoSuchKey';
}

/**
 * Fetches the lossless AVIF object for an ImageData id from the image bucket.
 *
 * @param imageDataId - ImageData UUID (key: `{imageDataId}/lossless.avif`)
 * @returns File bytes, or null if the object does not exist
 * @throws Error if IMAGE_BUCKET_NAME is not set, or for S3 errors other than NoSuchKey
 */
const getLosslessFile = async (imageDataId: string): Promise<Buffer | null> => {
    const bucket = process.env.IMAGE_BUCKET_NAME;
    if (!bucket) {
        throw new Error('IMAGE_BUCKET_NAME environment variable is not set');
    }

    const key = `${imageDataId}/lossless.avif`;
    try {
        const response = await getS3Client().send(
            new GetObjectCommand({
                Bucket: bucket,
                Key: key,
            }),
        );
        if (response.Body == null) {
            return null;
        }
        const bytes = await response.Body.transformToByteArray();
        return Buffer.from(bytes);
    } catch (err) {
        if (!isNoSuchKeyError(err)) {
            throw err;
        }
        return null;
    }
};

export default getLosslessFile;
