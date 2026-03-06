import * as db from 'zapatos/db';
import { RopewikiRegion } from '../types/region';

// Get all child regions (regions whose parentRegionName matches the given regionName).
// Returns an array of RopewikiRegion objects.
const getChildRegions = async (
    conn: db.Queryable,
    regionName: string,
): Promise<RopewikiRegion[]> => {
    // Find all regions where parentRegionName matches the region name (parentRegionName is a string, not a UUID)
    const childRegions = await db
        .select('RopewikiRegion', { parentRegionName: regionName })
        .run(conn);

    // Return an array of RopewikiRegion objects
    return childRegions.map(region => RopewikiRegion.fromDbRow(region));
};

export default getChildRegions;

