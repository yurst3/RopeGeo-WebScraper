import { replaceS3Folder } from 'ropegeo-common/helpers';
import { buildMapDataPublicUrl } from '../util/buildMapDataPublicUrl';

const PBF_CONTENT_TYPE = 'application/x-protobuf';

/**
 * Uploads a local tile directory to S3 under tiles/{mapDataId}/ and removes any
 * existing S3 objects in that prefix that are not in the new upload.
 * Returns the public URL for the tiles directory (same style as uploadMapDataToS3).
 */
export async function uploadMapDataTilesToS3(
    localTilesDir: string,
    mapDataId: string,
    bucket: string
): Promise<string> {
    const s3KeyPrefix = `tiles/${mapDataId}`;
    await replaceS3Folder(localTilesDir, s3KeyPrefix, bucket, PBF_CONTENT_TYPE);
    return buildMapDataPublicUrl(bucket, `${s3KeyPrefix}/`);
}
