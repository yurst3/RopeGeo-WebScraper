import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';

/**
 * Returns all non-deleted RopewikiPages that have no non-deleted beta sections.
 */
const getRopewikiPagesWithoutBetaSections = async (
    conn: db.Queryable,
): Promise<RopewikiPage[]> => {
    const rowsWithBetaSections = await db
        .select('RopewikiBetaSection', { deletedAt: db.conditions.isNull })
        .run(conn);

    const idsWithBetaSet = new Set(
        rowsWithBetaSections.map((row) => row.ropewikiPage),
    );

    const allPages = await db
        .select('RopewikiPage', { deletedAt: db.conditions.isNull })
        .run(conn);

    const rowsWithoutBeta = allPages.filter((row) => !idsWithBetaSet.has(row.id));
    return rowsWithoutBeta.map((row) => RopewikiPage.fromDbRow(row));
};

export default getRopewikiPagesWithoutBetaSections;
