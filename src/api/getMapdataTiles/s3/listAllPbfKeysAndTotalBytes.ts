import listS3Objects from '../../../helpers/s3/listS3Objects';

/**
 * Lists all `.pbf` object keys under `tiles/{mapDataId}/` and sums their byte sizes.
 * Keys are full S3 keys (e.g. `tiles/{uuid}/0/0/0.pbf`), sorted lexicographically.
 *
 * @throws Error if `MAP_DATA_BUCKET_NAME` is not set or empty
 */
const listAllPbfKeysAndTotalBytes = async (
    mapDataId: string,
): Promise<{ keys: string[]; totalBytes: number }> => {
    const bucket = process.env.MAP_DATA_BUCKET_NAME?.trim();
    if (!bucket) {
        throw new Error('MAP_DATA_BUCKET_NAME environment variable is not set');
    }

    const prefix = `tiles/${mapDataId}/`;
    const entries = await listS3Objects(bucket, prefix);
    const pbfEntries = entries.filter((e) => e.key.endsWith('.pbf'));
    const keys = pbfEntries.map((e) => e.key).sort((a, b) => a.localeCompare(b));
    const totalBytes = pbfEntries.reduce((sum, e) => sum + e.size, 0);

    return { keys, totalBytes };
};

export default listAllPbfKeysAndTotalBytes;
