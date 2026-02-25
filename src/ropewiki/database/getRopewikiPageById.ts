import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';

/**
 * Gets a single RopewikiPage by id (UUID).
 * Returns null if not found or the page is soft-deleted.
 */
const getRopewikiPageById = async (
    conn: db.Queryable,
    id: string,
): Promise<RopewikiPage | null> => {
    const row = await db
        .selectOne('RopewikiPage', { id, deletedAt: db.conditions.isNull })
        .run(conn);

    if (!row) {
        return null;
    }

    return RopewikiPage.fromDbRow(row);
};

export default getRopewikiPageById;
