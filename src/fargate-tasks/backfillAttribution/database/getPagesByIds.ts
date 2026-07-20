import * as db from 'zapatos/db';
import type { PageNeedingAuthors } from './getPagesNeedingAuthors';

/** Load page id/url for the given page ids (non-deleted only). */
export async function getPagesByIds(
    conn: db.Queryable,
    pageIds: string[],
): Promise<PageNeedingAuthors[]> {
    if (pageIds.length === 0) {
        return [];
    }
    return db.sql<db.SQL, PageNeedingAuthors[]>`
        SELECT id, url
        FROM "RopewikiPage"
        WHERE id = ANY(${db.param(pageIds)}::uuid[])
          AND "deletedAt" IS NULL
    `.run(conn);
}

export default getPagesByIds;
