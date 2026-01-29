import * as db from 'zapatos/db';
import RopewikiRoute from '../../types/pageRoute';
import filterPagesWithKmlUrl from '../database/filterPagesWithKmlUrl';

/**
 * Filters an array of RopewikiRoute objects to only include routes whose pages have KML URLs.
 * 
 * @param conn - Database connection
 * @param ropewikiRoutes - Array of RopewikiRoute objects to filter
 * @returns Promise that resolves to an array of RopewikiRoute objects whose pages have KML URLs
 */
const filterRopewikiRoutesWithMapData = async (
    conn: db.Queryable,
    ropewikiRoutes: RopewikiRoute[],
): Promise<RopewikiRoute[]> => {
    if (ropewikiRoutes.length === 0) {
        return [];
    }

    // Extract page IDs from RopewikiRoutes
    const pageIds = ropewikiRoutes.map(route => route.page);

    // Get page IDs that have KML URLs
    const pageIdsWithKml = await filterPagesWithKmlUrl(conn, pageIds);

    // Create a Set for O(1) lookup
    const pageIdsWithKmlSet = new Set(pageIdsWithKml);

    // Filter RopewikiRoutes to only include those whose pages have KML URLs
    return ropewikiRoutes.filter(route => pageIdsWithKmlSet.has(route.page));
};

export default filterRopewikiRoutesWithMapData;
