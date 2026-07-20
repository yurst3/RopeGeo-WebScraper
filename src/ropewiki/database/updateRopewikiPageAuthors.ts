import * as db from 'zapatos/db';

/** Persist page contributors; null clears / marks unresolved. */
export async function updateRopewikiPageAuthors(
    conn: db.Queryable,
    pageId: string,
    authors: string[] | null,
): Promise<void> {
    await db
        .update(
            'RopewikiPage',
            { authors, updatedAt: new Date() },
            { id: pageId },
        )
        .run(conn);
}

export default updateRopewikiPageAuthors;
