import * as db from 'zapatos/db';

/**
 * Updates truePageCount, trueRegionCount, and truePageCountWithDescendents for all
 * regions in RopewikiRegion (by parentRegion/name hierarchy). Call after all pages
 * have been upserted so counts reflect actual DB state.
 */
const updateRegionTrueCounts = async (conn: db.Queryable): Promise<void> => {
    await db.sql`
        WITH RECURSIVE tree AS (
            SELECT id, name FROM "RopewikiRegion" WHERE "deletedAt" IS NULL
        ),
        closure AS (
            SELECT id AS ancestor, id AS descendant FROM tree
            UNION ALL
            SELECT c.ancestor, r.id
            FROM closure c
            JOIN "RopewikiRegion" r ON r."parentRegion" = (SELECT t.name FROM tree t WHERE t.id = c.descendant) AND r."deletedAt" IS NULL
        ),
        counts AS (
            SELECT
                t.id,
                (SELECT COUNT(*)::integer FROM "RopewikiPage" p WHERE p.region = t.id AND p."deletedAt" IS NULL) AS "truePageCount",
                (SELECT COUNT(*)::integer FROM "RopewikiRegion" r2 WHERE r2."parentRegion" = t.name AND r2."deletedAt" IS NULL) AS "trueRegionCount",
                (SELECT COUNT(*)::integer FROM "RopewikiPage" p WHERE p.region IN (SELECT cl.descendant FROM closure cl WHERE cl.ancestor = t.id) AND p."deletedAt" IS NULL) AS "truePageCountWithDescendents"
            FROM tree t
        )
        UPDATE "RopewikiRegion" r
        SET
            "truePageCount" = counts."truePageCount",
            "trueRegionCount" = counts."trueRegionCount",
            "truePageCountWithDescendents" = counts."truePageCountWithDescendents"
        FROM counts
        WHERE r.id = counts.id AND r."allowUpdates" = true
    `.run(conn);
};

export default updateRegionTrueCounts;
