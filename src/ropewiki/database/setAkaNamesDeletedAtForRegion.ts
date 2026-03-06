import * as db from 'zapatos/db';

/**
 * Soft-deletes all RopewikiAkaName rows for pages in the given region and its descendant regions.
 * Only rows with deletedAt IS NULL are updated. Call before upserting pages for a region so that
 * upsertAkaNames can then restore only the current aka list.
 */
const setAkaNamesDeletedAtForRegion = async (
    tx: db.Queryable,
    regionUuid: string,
): Promise<void> => {
    const now = new Date();
    await db.sql`
        WITH RECURSIVE region_and_descendants AS (
            SELECT id, name FROM "RopewikiRegion"
            WHERE id = ${db.param(regionUuid)}::uuid AND "deletedAt" IS NULL
            UNION ALL
            SELECT r.id, r.name FROM "RopewikiRegion" r
            INNER JOIN region_and_descendants d ON (
                r."parentRegion" = d.name OR r."parentRegion" = d.id::text
            )
            WHERE r."deletedAt" IS NULL
        )
        UPDATE "RopewikiAkaName" a
        SET "deletedAt" = ${db.param(now)}, "updatedAt" = ${db.param(now)}
        FROM "RopewikiPage" p
        WHERE a."ropewikiPage" = p.id
          AND p.region IN (SELECT id FROM region_and_descendants)
          AND a."deletedAt" IS NULL
          AND a."allowUpdates" = true
    `.run(tx);
};

export default setAkaNamesDeletedAtForRegion;
