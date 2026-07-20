import * as db from 'zapatos/db';

export type MapDataNeedingAuthors = { id: string; sourceFileUrl: string };

/** Non-deleted MapData rows with authors null and a non-empty sourceFileUrl. */
export async function getMapDataNeedingAuthors(
    conn: db.Queryable,
): Promise<MapDataNeedingAuthors[]> {
    return db.sql<db.SQL, MapDataNeedingAuthors[]>`
        SELECT id, "sourceFileUrl"
        FROM "MapData"
        WHERE "deletedAt" IS NULL
          AND authors IS NULL
          AND "sourceFileUrl" <> ''
        ORDER BY "updatedAt" ASC
    `.run(conn);
}

export default getMapDataNeedingAuthors;
