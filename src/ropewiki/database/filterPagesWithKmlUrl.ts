import * as db from 'zapatos/db';

/**
 * Filters an array of page IDs to return only those that have a KML URL.
 * 
 * @param conn - Database connection
 * @param pageIds - Array of page IDs to filter
 * @returns Promise that resolves to an array of page IDs that have a KML URL
 */
const filterPagesWithKmlUrl = async (
    conn: db.Queryable,
    pageIds: string[],
): Promise<string[]> => {
    if (pageIds.length === 0) {
        return [];
    }

    const rows = await db
        .select(
            'RopewikiPage',
            {
                id: db.conditions.isIn(pageIds),
                kmlUrl: db.conditions.isNotNull,
            },
        )
        .run(conn);

    return rows.map(row => row.id as string);
};

export default filterPagesWithKmlUrl;
