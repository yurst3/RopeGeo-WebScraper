import * as db from 'zapatos/db';
import { default as upsertRopewikiRoute } from '../../ropewiki/database/upsertRopewikiRoute';
import { PageDataSource } from 'ropegeo-common/models';
import { PageRoute, RopewikiRoute } from '../../types/pageRoute';

/**
 * Upserts a page-route link with optional mapData based on the data source.
 * 
 * @param conn - Database connection
 * @param pageDataSource - Source of the page data (e.g., PageDataSource.Ropewiki)
 * @param pageRoute - The PageRoute object to upsert
 * @returns Promise that resolves when the upsert is complete
 */
const upsertPageRoute = async (
    conn: db.Queryable,
    pageDataSource: PageDataSource,
    pageRoute: PageRoute,
): Promise<void> => {
    switch (pageDataSource) {
        case PageDataSource.Ropewiki:
            return await upsertRopewikiRoute(conn, pageRoute as RopewikiRoute);
    }
};

export default upsertPageRoute;
