import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';
import { Route } from '../../types/route';

/**
 * Correlates existing routes with pages.
 * Currently returns the input unchanged, but will be implemented in the future
 * when we implement scraping from other websites to match routes across different sources.
 * 
 * @param routesAndPages - Array of [Route | null, RopewikiPage] tuples
 * @returns Array of [Route | null, RopewikiPage] tuples
 */
const correlateExistingRoutes = async (
    conn: db.Queryable,
    routesAndPages: Array<[Route | null, RopewikiPage]>,
): Promise<Array<[Route | null, RopewikiPage]>> => {
    // TODO: Implement route correlation logic when scraping from other websites
    return routesAndPages;
};

export default correlateExistingRoutes;
