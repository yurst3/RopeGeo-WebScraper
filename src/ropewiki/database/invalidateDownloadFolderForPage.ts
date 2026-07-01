import * as db from 'zapatos/db';

/**
 * Clears cached download bundle URLs so the daily zipper rebuilds on the next run.
 */
export async function invalidateDownloadFolderForPages(
    conn: db.Queryable,
    pageIds: string[],
): Promise<void> {
    if (pageIds.length === 0) {
        return;
    }
    await db
        .update(
            'RopewikiPage',
            { downloadFolder: null, downloadFolderBuiltAt: null },
            { id: db.conditions.isIn(pageIds) },
        )
        .run(conn);
}
