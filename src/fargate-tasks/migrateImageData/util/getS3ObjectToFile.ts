import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '../../../helpers/s3/getS3Client';

/**
 * Streams an S3 object to a local file. Use for binary content (e.g. AVIF) that
 * should not be loaded into memory as a string.
 *
 * @param bucket - S3 bucket name
 * @param key - S3 object key
 * @param destPath - Local file path to write to
 * @throws NoSuchKey or other S3 errors (caller should handle 404)
 */
export const getS3ObjectToFile = async (
    bucket: string,
    key: string,
    destPath: string,
): Promise<void> => {
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

    await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destPath));
};
