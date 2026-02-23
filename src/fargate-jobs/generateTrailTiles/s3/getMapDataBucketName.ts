/**
 * Returns MAP_DATA_BUCKET_NAME from env. Throws if not set.
 */
export function getMapDataBucketName(): string {
    const bucket = process.env.MAP_DATA_BUCKET_NAME;
    if (!bucket) {
        throw new Error('MAP_DATA_BUCKET_NAME is required');
    }
    return bucket;
}
