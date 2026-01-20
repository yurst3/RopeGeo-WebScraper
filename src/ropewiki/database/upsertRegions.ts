import * as db from 'zapatos/db';
import { RopewikiRegion } from '../types/region';

// Insert or update a batch of regions.
// On conflict (same name and parentRegion), update all region fields and timestamps.
// Returns all upserted regions from the database.
const upsertRegions = async (
    conn: db.Queryable,
    regions: RopewikiRegion[],
): Promise<RopewikiRegion[]> => {
    if (regions.length === 0) return [];

    const rows = regions.map((region) => region.toDbRow());

    const results = await db
        .upsert('RopewikiRegion', rows, ['name', 'parentRegion'], {
            updateColumns: ['pageCount', 'level', 'overview', 'bestMonths', 'isMajorRegion', 'isTopLevelRegion', 'latestRevisionDate', 'url', 'updatedAt', 'deletedAt'],
        })
        .run(conn);

    return results.map((row) => RopewikiRegion.fromDbRow(row));
};

export default upsertRegions;


