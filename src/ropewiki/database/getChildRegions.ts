import * as db from 'zapatos/db';
import { RopewikiRegion } from '../types/region';

// Get all child regions (regions whose parentRegion matches the given regionName).
// Returns an array of RopewikiRegion objects.
const getChildRegions = async (
    conn: db.Queryable,
    regionName: string,
): Promise<RopewikiRegion[]> => {
    // Find all regions where parentRegion matches the region name (parentRegion is now a string, not a UUID)
    const childRegions = await db
        .select('RopewikiRegion', { parentRegion: regionName })
        .run(conn);

    // Return an array of RopewikiRegion objects
    return childRegions.map(region => RopewikiRegion.fromDbRow(region));
};

export default getChildRegions;

