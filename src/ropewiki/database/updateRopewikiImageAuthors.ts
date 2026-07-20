import * as db from 'zapatos/db';

export type ImageAuthorsUpdate = {
    id: string;
    authors: string[] | null;
};

/** Batch-update RopewikiImage.authors by id. */
export async function updateRopewikiImageAuthors(
    conn: db.Queryable,
    updates: ImageAuthorsUpdate[],
): Promise<void> {
    if (updates.length === 0) return;

    for (const update of updates) {
        await db
            .update(
                'RopewikiImage',
                { authors: update.authors, updatedAt: new Date() },
                { id: update.id },
            )
            .run(conn);
    }
}

export default updateRopewikiImageAuthors;
