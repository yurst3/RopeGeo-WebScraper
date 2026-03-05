import * as db from 'zapatos/db';

/**
 * Soft-deletes all RopewikiPage rows for the given region and its descendant regions.
 * Only rows with deletedAt IS NULL are updated.
 */
const setPagesDeletedAtForRegion = async (
    tx: db.Queryable,
    regionUuid: string,
): Promise<void> => {
    const now = new Date();
    await db.sql`
        WITH RECURSIVE region_and_descendants AS (
            SELECT id FROM "RopewikiRegion"
            WHERE id = ${db.param(regionUuid)}::uuid AND "deletedAt" IS NULL
            UNION ALL
            SELECT r.id FROM "RopewikiRegion" r
            INNER JOIN region_and_descendants d ON r."parentRegion" = d.id::text
            WHERE r."deletedAt" IS NULL
        )
        UPDATE "RopewikiPage"
        SET "deletedAt" = ${db.param(now)}
        WHERE region IN (SELECT id FROM region_and_descendants)
          AND "deletedAt" IS NULL
    `.run(tx);
};

export default setPagesDeletedAtForRegion;
