import { replaceS3Folder } from 'ropegeo-common/helpers';

const PBF_CONTENT_TYPE = 'application/x-protobuf';

/**
 * Replaces the S3 prefix s3KeyPrefix with the local tiles: uploads from /tmp/{localTilesDir},
 * then removes any existing S3 objects that weren't overwritten.
 */
export async function uploadTilesToS3(
    localTilesDir: string,
    s3KeyPrefix: string,
    bucket: string
): Promise<void> {
    const localDir = '/tmp/' + localTilesDir;
    await replaceS3Folder(localDir, s3KeyPrefix, bucket, PBF_CONTENT_TYPE);
}
