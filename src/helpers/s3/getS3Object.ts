import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from './getS3Client';

export type GetS3ObjectResult = {
    body: string;
    contentType?: string;
};

/**
 * Fetches an object from S3 and returns its body as a string and optional Content-Type.
 * Uses the shared S3 client from getS3Client.
 *
 * @param bucket - S3 bucket name
 * @param key - S3 object key
 * @returns Object with body (string) and optional contentType from the response
 * @throws NoSuchKey or other S3 errors (caller should handle for 404/500)
 */
const getS3Object = async (bucket: string, key: string): Promise<GetS3ObjectResult> => {
    const s3Client = getS3Client();

    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        }),
    );

    if (response.Body == null) {
        const err = new Error('S3 GetObject returned no body');
        (err as Error & { name: string }).name = 'NoSuchKey';
        throw err;
    }

    const body = await response.Body.transformToString();
    const contentType = response.ContentType;

    return contentType !== undefined ? { body, contentType } : { body };
};

export default getS3Object;
