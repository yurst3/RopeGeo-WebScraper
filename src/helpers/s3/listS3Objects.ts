import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3Client } from './getS3Client';

export type S3ObjectEntry = {
    key: string;
    size: number;
};

/**
 * Lists all objects under an S3 prefix (paginated via continuation tokens).
 * Prefix is normalized the same way as `listS3Folder`: a trailing slash is ensured so listing is consistent.
 *
 * @param bucket - S3 bucket name
 * @param prefix - Key prefix (e.g. `tiles/uuid` or `tiles/uuid/`); normalized to end with `/`
 * @returns One entry per object (key + ContentLength, missing size treated as 0)
 */
const listS3Objects = async (bucket: string, prefix: string): Promise<S3ObjectEntry[]> => {
    const normalizedPrefix = prefix.replace(/\/$/, '') + '/';
    const client = getS3Client();
    const entries: S3ObjectEntry[] = [];
    let continuationToken: string | undefined;

    do {
        const list = await client.send(
            new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: normalizedPrefix,
                ContinuationToken: continuationToken,
            }),
        );
        if (list.Contents?.length) {
            for (const obj of list.Contents) {
                if (obj.Key == null) continue;
                const size = obj.Size ?? 0;
                entries.push({ key: obj.Key, size });
            }
        }
        continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (continuationToken);

    return entries;
};

export default listS3Objects;
