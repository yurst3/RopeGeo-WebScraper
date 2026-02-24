import ProgressLogger from '../progressLogger';
import { deleteS3Object } from './deleteS3Object';
import { listS3Folder } from './listS3Folder';
import { putS3Folder } from './putS3Folder';

/**
 * Replaces the contents of an S3 "folder" with the local folder: uploads all local files
 * under keyPrefix, then deletes any existing S3 objects in that prefix that were not
 * in the set of keys we attempted to upload. Keys that failed to upload are not
 * deleted, so existing files are not removed when an overwrite fails.
 * Logs progress and success/error counts for the deletion phase via ProgressLogger.
 *
 * @param inFolder - Local directory to upload (e.g. /tmp/trails)
 * @param keyPrefix - S3 key prefix (e.g. trails or routeMarkers). No trailing slash.
 * @param bucket - S3 bucket name
 * @param contentType - Content-Type header for every uploaded file
 */
export async function replaceS3Folder(
    inFolder: string,
    keyPrefix: string,
    bucket: string,
    contentType: string
): Promise<void> {
    const existingKeys = await listS3Folder(bucket, keyPrefix);
    const uploadedKeys = await putS3Folder(inFolder, keyPrefix, bucket, contentType);
    const uploadedSet = new Set(uploadedKeys);
    const toDelete = existingKeys.filter((key) => !uploadedSet.has(key));

    if (toDelete.length > 0) {
        const logger = new ProgressLogger('Deleting obsolete S3 objects', toDelete.length);
        await Promise.all(
            toDelete.map(async (key) => {
                try {
                    await deleteS3Object(bucket, key);
                    logger.logProgress(key);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    logger.logError(`${key}: ${message}`);
                }
            })
        );
        const { successes, errors } = logger.getResults();
        console.log(
            `Deletion complete: ${successes} success(es), ${errors} error(s) from s3://${bucket}/${keyPrefix.replace(/\/$/, '')}/`
        );
    }
}
