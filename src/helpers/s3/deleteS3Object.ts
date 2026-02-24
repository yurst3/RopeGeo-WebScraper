import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from './getS3Client';

/**
 * Deletes a single object from S3.
 */
export async function deleteS3Object(bucket: string, key: string): Promise<void> {
    const client = getS3Client();
    await client.send(
        new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        })
    );
}
