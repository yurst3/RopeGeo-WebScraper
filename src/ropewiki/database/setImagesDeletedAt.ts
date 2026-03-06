import * as db from 'zapatos/db';

// Soft-delete all images for the given page (set deletedAt and order = null).
// Call before upserting the new set to avoid unique constraint conflicts on order.
const setImagesDeletedAt = async (
    tx: db.Queryable,
    pageUuid: string,
): Promise<void> => {
    const now = new Date();

    await db
        .update(
            'RopewikiImage',
            { deletedAt: now, order: null as number | null },
            {
                ropewikiPage: pageUuid,
                deletedAt: db.conditions.isNull,
                allowUpdates: true,
            }
        )
        .run(tx);
};

export default setImagesDeletedAt;

