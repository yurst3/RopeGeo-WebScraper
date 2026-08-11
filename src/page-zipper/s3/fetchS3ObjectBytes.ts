import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from 'ropegeo-common/helpers';

export async function fetchS3ObjectBytes(bucket: string, key: string): Promise<Buffer> {
    const response = await getS3Client().send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        }),
    );
    if (response.Body == null) {
        throw new Error(`S3 object not found: s3://${bucket}/${key}`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
}
