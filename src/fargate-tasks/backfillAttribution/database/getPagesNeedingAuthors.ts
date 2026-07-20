import * as db from 'zapatos/db';

export type PageNeedingAuthors = { id: string; url: string };

/** Non-deleted RopewikiPage rows with authors still null. */
export async function getPagesNeedingAuthors(
    conn: db.Queryable,
): Promise<PageNeedingAuthors[]> {
    return db.sql<db.SQL, PageNeedingAuthors[]>`
        SELECT id, url
        FROM "RopewikiPage"
        WHERE "deletedAt" IS NULL
          AND authors IS NULL
        ORDER BY "updatedAt" ASC
    `.run(conn);
}

export default getPagesNeedingAuthors;
