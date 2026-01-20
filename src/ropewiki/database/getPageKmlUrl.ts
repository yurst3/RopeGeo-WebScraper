import * as db from 'zapatos/db';

// Get the KML URL for a page by its ID.
// Returns undefined if the page is not found or has no KML URL.
const getPageKmlUrl = async (
    conn: db.Queryable,
    pageId: string,
): Promise<string | undefined> => {
    const row = await db
        .selectOne('RopewikiPage', { id: pageId })
        .run(conn);

    if (!row) {
        return undefined;
    }

    return row.kmlUrl ?? undefined;
};

export default getPageKmlUrl;
