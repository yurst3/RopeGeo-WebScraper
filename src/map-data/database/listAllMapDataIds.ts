import * as db from 'zapatos/db';

/**
 * Returns all non-deleted MapData ids.
 */
export async function listAllMapDataIds(conn: db.Queryable): Promise<string[]> {
    const rows = await db.sql<db.SQL, { id: string }[]>`
        SELECT id
        FROM "MapData"
        WHERE "deletedAt" IS NULL
        ORDER BY id ASC
    `.run(conn);
    return rows.map((row) => row.id);
}
