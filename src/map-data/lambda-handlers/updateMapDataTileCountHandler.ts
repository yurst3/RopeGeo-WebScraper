import type { Pool, PoolClient } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import listAllPbfKeysAndTotalBytes from '../../api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes';
import { listAllMapDataIds } from '../database/listAllMapDataIds';
import { updateMapDataTileCount } from '../database/updateMapDataTileCount';

/**
 * One-time / on-demand backfill: for each non-deleted MapData row, list S3 `.pbf` tiles
 * and persist tileCount / tileTotalBytes.
 */
export const updateMapDataTileCountHandler = async (): Promise<{
    statusCode: number;
    body: string;
}> => {
    let pool: Pool | undefined;
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const mapDataIds = await listAllMapDataIds(client);
        let updatedCount = 0;
        const errors: Array<{ mapDataId: string; error: string }> = [];

        console.log(`MapDataTileCountUpdator: processing ${mapDataIds.length} MapData row(s)...`);

        for (const mapDataId of mapDataIds) {
            try {
                const { keys, totalBytes } = await listAllPbfKeysAndTotalBytes(mapDataId);
                await updateMapDataTileCount(client, mapDataId, keys.length, totalBytes);
                updatedCount += 1;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push({ mapDataId, error: message });
                console.error(`MapDataTileCountUpdator: failed for ${mapDataId}:`, message);
            }
        }

        return {
            statusCode: errors.length > 0 ? 207 : 200,
            body: JSON.stringify({
                message: 'MapData tile count update completed',
                processedCount: mapDataIds.length,
                updatedCount,
                errorCount: errors.length,
                errors,
            }),
        };
    } catch (error) {
        console.error('Error in MapDataTileCountUpdator:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'MapData tile count update failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        client?.release();
    }
};
