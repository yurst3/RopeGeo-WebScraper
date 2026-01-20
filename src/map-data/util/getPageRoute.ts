import * as db from 'zapatos/db';
import { default as getRopewikiRoute } from '../../ropewiki/database/getRopewikiRoute';
import { PageDataSource } from '../types/mapData';
import { PageRoute } from '../../types/pageRoute';

/**
 * Gets the existing PageRoute for a page-route combination based on the data source.
 * 
 * @param conn - Database connection
 * @param pageDataSource - Source of the page data (e.g., PageDataSource.Ropewiki)
 * @param pageId - ID of the page
 * @param routeId - ID of the route
 * @returns Promise that resolves to the existing PageRoute, or undefined if not found
 */
const getPageRoute = async (
    conn: db.Queryable,
    pageDataSource: PageDataSource,
    pageId: string,
    routeId: string,
): Promise<PageRoute | undefined> => {
    switch (pageDataSource) {
        case PageDataSource.Ropewiki: {
            const ropewikiRoute = await getRopewikiRoute(conn, routeId, pageId);
            // RopewikiRoute extends PageRoute, so we can return it directly as PageRoute
            return ropewikiRoute;
        }
    }
};

export default getPageRoute;
