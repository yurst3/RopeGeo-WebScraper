import * as db from 'zapatos/db';

/**
 * Inserts or restores aka names for a page (one row per unique non-empty name).
 * ON CONFLICT (ropewikiPage, name) restores deletedAt = null. Does not soft-delete existing rows;
 * call setAkaNamesDeletedAtForRegion before upserting pages so that stale aka rows are already soft-deleted.
 */
const upsertAkaNames = async (
    tx: db.Queryable,
    pageUuid: string,
    akaNames: string[],
): Promise<void> => {
    const uniqueNames = [...new Set(akaNames.map((n) => n.trim()).filter((n) => n.length > 0))];
    if (uniqueNames.length === 0) return;

    const now = new Date();
    await db.sql`
        INSERT INTO "RopewikiAkaName" ("ropewikiPage", "name")
        SELECT ${db.param(pageUuid)}, unnest(${db.param(uniqueNames)}::text[])
        ON CONFLICT ("ropewikiPage", "name") DO UPDATE SET
            "deletedAt" = NULL,
            "updatedAt" = ${db.param(now)}
    `.run(tx);
};

export default upsertAkaNames;
