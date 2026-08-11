import * as db from 'zapatos/db';

/**
 * Returns true when the page has at least one RopewikiRoute with deletedAt IS NULL.
 *
 * @param conn - Database connection
 * @param pageId - RopewikiPage id
 */
const hasActiveRopewikiRoutesForPage = async (
    conn: db.Queryable,
    pageId: string,
): Promise<boolean> => {
    const row = await db
        .selectOne('RopewikiRoute', {
            ropewikiPage: pageId,
            deletedAt: db.conditions.isNull,
        })
        .run(conn);
    return row != null;
};

export default hasActiveRopewikiRoutesForPage;
