import getChildRegions from "../database/getChildRegions";
import getRegion from "../database/getRegion";
import { Queryable } from "zapatos/db";
import { RopewikiRegion } from "../types/region";

/*
Gets the highest level regions with a page count less than or equal to a certain limit.
If there are regions with page counts that exceed the limit, get the over-limit region's children until all are less than or equal to the limit.
Returns an array of RopewikiRegion objects.
*/
const getRegionCountsUnderLimit = async (conn: Queryable, rootRegionName: string, limit: number): Promise<RopewikiRegion[]> => {
    if (limit <= 0) throw new Error('Limit must be greater than 0');
    
    // Get the root region
    const rootRegion = await getRegion(conn, rootRegionName);
    if (!rootRegion) {
        throw new Error(`Region not found: ${rootRegionName}`);
    }

    let regions: RopewikiRegion[] = [rootRegion];

    while (true) {
        const overLimitRegions = regions.filter(region => region.pageCount > limit);
        const underLimitRegions = regions.filter(region => region.pageCount <= limit);

        // If all regions are under limit, we're done
        if (overLimitRegions.length === 0) {
            return underLimitRegions;
        }

        // Get child regions for all over-limit regions
        const overLimitChildRegionsArrays: RopewikiRegion[][] = await Promise.all(
            overLimitRegions.map(region => getChildRegions(conn, region.name))
        );

        // Check if any over-limit region has no children
        if (overLimitChildRegionsArrays.some(childRegions => !childRegions.length)) {
            throw new Error(`A region without any children exceeds the limit of ${limit}`);
        }

        // Flatten the array of child region arrays
        const allChildRegions = overLimitChildRegionsArrays.flat();

        // Replace over-limit regions with their children
        regions = [...underLimitRegions, ...allChildRegions];
    }
}

export default getRegionCountsUnderLimit;