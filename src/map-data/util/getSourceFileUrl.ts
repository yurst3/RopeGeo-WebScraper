import * as db from 'zapatos/db';
import { default as getRopewikiPageKmlUrl } from '../../ropewiki/database/getPageKmlUrl';
import { PageDataSource } from '../../types/pageRoute';

/**
 * Gets the source file URL (e.g., KML URL) for a page based on the data source.
 * 
 * @param conn - Database connection
 * @param pageDataSource - Source of the page data (e.g., PageDataSource.Ropewiki)
 * @param pageId - ID of the page
 * @returns Promise that resolves to the source file URL, or undefined if not found
 */
const getSourceFileUrl = async (
    conn: db.Queryable,
    pageDataSource: PageDataSource,
    pageId: string,
): Promise<string | undefined> => {
    switch (pageDataSource) {
        case PageDataSource.Ropewiki:
            return await getRopewikiPageKmlUrl(conn, pageId);
    }
};

export default getSourceFileUrl;
