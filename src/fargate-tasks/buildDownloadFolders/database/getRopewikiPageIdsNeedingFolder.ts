import * as db from 'zapatos/db';

/** Ropewiki page ids eligible for the daily bundle build (not deleted, no current bundle URL). */
export async function getRopewikiPageIdsNeedingFolder(conn: db.Queryable): Promise<string[]> {
    const rows = await db
        .select(
            'RopewikiPage',
            { deletedAt: db.conditions.isNull, downloadFolder: db.conditions.isNull },
            { columns: ['id'] },
        )
        .run(conn);
    return rows.map((row) => row.id);
}
