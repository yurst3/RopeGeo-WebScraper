import * as db from 'zapatos/db';

/** Persist MapData.authors; null clears / marks unresolved. */
export async function updateMapDataAuthors(
    conn: db.Queryable,
    mapDataId: string,
    authors: string[] | null,
): Promise<void> {
    await db
        .update(
            'MapData',
            { authors, updatedAt: new Date() },
            { id: mapDataId },
        )
        .run(conn);
}

export default updateMapDataAuthors;
