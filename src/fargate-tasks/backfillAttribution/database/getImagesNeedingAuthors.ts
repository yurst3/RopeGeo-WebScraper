import * as db from 'zapatos/db';

export type ImageNeedingAuthors = {
    id: string;
    ropewikiPage: string;
    linkUrl: string;
};

/** Non-deleted RopewikiImage rows with authors still null. */
export async function getImagesNeedingAuthors(
    conn: db.Queryable,
): Promise<ImageNeedingAuthors[]> {
    return db.sql<db.SQL, ImageNeedingAuthors[]>`
        SELECT id, "ropewikiPage", "linkUrl"
        FROM "RopewikiImage"
        WHERE "deletedAt" IS NULL
          AND authors IS NULL
        ORDER BY "updatedAt" ASC
    `.run(conn);
}

export default getImagesNeedingAuthors;
