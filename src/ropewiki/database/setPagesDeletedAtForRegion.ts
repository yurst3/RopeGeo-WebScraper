import * as db from 'zapatos/db';

// Soft-delete all RopewikiPage rows for the given region (set deletedAt = now).
const setPagesDeletedAtForRegion = async (
    tx: db.Queryable,
    regionUuid: string,
): Promise<void> => {
    const now = new Date();

    await db
        .update(
            'RopewikiPage',
            { deletedAt: now },
            {
                region: regionUuid,
                deletedAt: db.conditions.isNull,
            }
        )
        .run(tx);
};

export default setPagesDeletedAtForRegion;
