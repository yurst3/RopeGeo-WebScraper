import * as db from 'zapatos/db';

export type RopewikiPageForFolderReadiness = {
    id: string;
    deletedAt: db.TimestampString | null;
    region: string;
};

/** Loads RopewikiPage row fields needed for download-folder readiness checks. */
export async function getRopewikiPageForFolderReadiness(
    conn: db.Queryable,
    pageId: string,
): Promise<RopewikiPageForFolderReadiness | null> {
    const rows = await db
        .select(
            'RopewikiPage',
            { id: pageId },
            { columns: ['id', 'deletedAt', 'region'] },
        )
        .run(conn);
    return rows[0] ?? null;
}
