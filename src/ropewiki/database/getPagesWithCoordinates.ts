import * as db from 'zapatos/db';
import RopewikiPageInfo from '../types/ropewiki';

const getPagesWithCoordinates = async (
    conn: db.Queryable,
    pageUuids: string[],
): Promise<RopewikiPageInfo[]> => {
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

    // Transform database rows to RopewikiPageInfo objects
    return rows.map(row => RopewikiPageInfo.fromDbRow(row));
};

export default getPagesWithCoordinates;
