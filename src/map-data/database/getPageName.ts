import * as db from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common/models';

/**
 * Returns the display name for a page, based on its data source.
 */
const getPageName = async (
    conn: db.Queryable,
    pageId: string,
    pageSource: PageDataSource,
): Promise<string | undefined> => {
    switch (pageSource) {
        case PageDataSource.Ropewiki: {
            const row = await db
                .selectOne('RopewikiPage', { id: pageId }, { columns: ['name'] })
                .run(conn);
            return row?.name;
        }
    }
};

export default getPageName;
