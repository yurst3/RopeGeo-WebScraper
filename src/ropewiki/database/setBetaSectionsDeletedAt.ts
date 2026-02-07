import * as db from 'zapatos/db';

// Soft-delete all beta sections for the given page (set deletedAt and order = null).
// Call before upserting the new set to avoid uk_ropewikiPageBetaSection_ropewikiPage_order conflicts.
const setBetaSectionsDeletedAt = async (
    tx: db.Queryable,
    pageUuid: string,
): Promise<void> => {
    const now = new Date();

    await db
        .update(
            'RopewikiPageBetaSection',
            { deletedAt: now, order: null as number | null },
            {
                ropewikiPage: pageUuid,
                deletedAt: db.conditions.isNull,
            }
        )
        .run(tx);
};

export default setBetaSectionsDeletedAt;

