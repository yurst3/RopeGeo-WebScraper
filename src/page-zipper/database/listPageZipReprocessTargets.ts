import * as db from 'zapatos/db';

export type PageZipReprocessTarget = {
    pageId: string;
};

/**
 * Ropewiki pages eligible for folder reprocess: not deleted, no current downloadFolder.
 * When `includePageIds` is set, only those ids (still matching eligibility) are returned.
 */
export async function listPageZipReprocessTargets(
    conn: db.Queryable,
    includePageIds?: string[],
): Promise<PageZipReprocessTarget[]> {
    const where =
        includePageIds != null
            ? {
                  deletedAt: db.conditions.isNull,
                  downloadFolder: db.conditions.isNull,
                  id: db.conditions.isIn(includePageIds),
              }
            : {
                  deletedAt: db.conditions.isNull,
                  downloadFolder: db.conditions.isNull,
              };

    const rows = await db
        .select('RopewikiPage', where, { columns: ['id'] })
        .run(conn);

    return rows.map((row) => ({ pageId: row.id }));
}
