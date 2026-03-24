import { buildMapDataPublicUrl } from '../../../map-data/util/buildMapDataPublicUrl';
import listAllPbfKeysAndTotalBytes from '../s3/listAllPbfKeysAndTotalBytes';

export type TilesAndTotalBytes = {
    /** Full public URLs for each tile (same order as S3 keys from listing). */
    results: string[];
    /** Sum of byte sizes of all `.pbf` objects for this map data id (entire set, not only the current page). */
    totalBytes: number;
};

/**
 * Lists all vector tile object keys for a map data id, maps each key to its public HTTPS URL
 * (via `buildMapDataPublicUrl`), and returns URLs plus aggregate byte size for pagination responses.
 */
const getTilesAndTotalBytes = async (mapDataId: string): Promise<TilesAndTotalBytes> => {
    const { keys, totalBytes } = await listAllPbfKeysAndTotalBytes(mapDataId);
    const bucket = process.env.MAP_DATA_BUCKET_NAME?.trim();
    if (!bucket) {
        throw new Error('MAP_DATA_BUCKET_NAME environment variable is not set');
    }
    const results = keys.map((key) => buildMapDataPublicUrl(bucket, key));
    return { results, totalBytes };
};

export default getTilesAndTotalBytes;
