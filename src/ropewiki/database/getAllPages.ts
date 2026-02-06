import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';

/**
 * Gets all RopewikiPages in the database (excluding soft-deleted).
 *
 * @param conn - Database connection
 * @returns Promise that resolves to all non-deleted RopewikiPage objects
 */
const getAllPages = async (conn: db.Queryable): Promise<RopewikiPage[]> => {
    const rows = await db
        .select('RopewikiPage', {
            deletedAt: db.conditions.isNull,
        })
        .run(conn);

    return rows.map((row) => RopewikiPage.fromDbRow(row));
};

export default getAllPages;
