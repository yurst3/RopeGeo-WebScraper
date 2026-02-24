import { putS3Folder } from '../../../helpers/s3/putS3Folder';

const PBF_CONTENT_TYPE = 'application/x-protobuf';

/**
 * Uploads tiles from /tmp/{tilesDir} to S3 at {tilesDir}/{z}/{x}/{y}.pbf (or other structure from tippecanoe).
 */
export async function uploadTilesToS3(tilesDir: string, bucket: string): Promise<void> {
    const localDir = '/tmp/' + tilesDir;
    await putS3Folder(localDir, tilesDir, bucket, PBF_CONTENT_TYPE);
}
