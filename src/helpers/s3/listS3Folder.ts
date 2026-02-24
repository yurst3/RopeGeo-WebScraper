import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3Client } from './getS3Client';

/**
 * Lists all object keys in an S3 "folder" (objects with the given prefix).
 * Prefix is normalized to end with / so that e.g. "trails" lists keys under "trails/".
 *
 * @returns Array of full S3 keys (e.g. ["trails/0/0/0.pbf", "trails/1/0/0.pbf"])
 */
export async function listS3Folder(bucket: string, prefix: string): Promise<string[]> {
    const normalizedPrefix = prefix.replace(/\/$/, '') + '/';
    const client = getS3Client();
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
        const list = await client.send(
            new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: normalizedPrefix,
                ContinuationToken: continuationToken,
            })
        );
        if (list.Contents?.length) {
            for (const obj of list.Contents) {
                if (obj.Key) keys.push(obj.Key);
            }
        }
        continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
}
