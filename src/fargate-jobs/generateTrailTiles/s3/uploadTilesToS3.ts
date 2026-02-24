import { replaceS3Folder } from '../../../helpers/s3/replaceS3Folder';

const PBF_CONTENT_TYPE = 'application/x-protobuf';

/**
 * Replaces the S3 prefix {tilesDir}/ with the local tiles: uploads from /tmp/{tilesDir},
 * then removes any existing S3 objects that weren't overwritten.
 */
export async function uploadTilesToS3(tilesDir: string, bucket: string): Promise<void> {
    const localDir = '/tmp/' + tilesDir;
    await replaceS3Folder(localDir, tilesDir, bucket, PBF_CONTENT_TYPE);
}
