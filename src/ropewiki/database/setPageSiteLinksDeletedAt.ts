import * as db from 'zapatos/db';

// Soft-delete all page-site links for the given page (set deletedAt = now).
// Call before upserting the new set.
const setPageSiteLinksDeletedAt = async (
    tx: db.Queryable,
    pageUuid: string,
): Promise<void> => {
    const now = new Date();

    await db
        .update(
            'RopewikiPageSiteLink',
            { deletedAt: now },
            {
                page: pageUuid,
                deletedAt: db.conditions.isNull,
            }
        )
        .run(tx);
};

export default setPageSiteLinksDeletedAt;
