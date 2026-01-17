import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';

const getPagesWithCoordinates = async (
    conn: db.Queryable,
    pageUuids: string[],
): Promise<RopewikiPage[]> => {
    if (pageUuids.length === 0) {
        return [];
    }

    const allRows = await db.select(
        'RopewikiPage',
        {
            id: db.conditions.isIn(pageUuids),
            coordinates: db.conditions.isNotNull,
        },
    ).run(conn);

    // Filter for pages where coordinates is not null
    const rows = allRows.filter(row => row.coordinates !== null);

    // Transform database rows to RopewikiPage objects
    return rows.map(row => RopewikiPage.fromDbRow(row));
};

export default getPagesWithCoordinates;
