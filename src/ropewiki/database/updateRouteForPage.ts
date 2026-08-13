import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';

/**
 * Updates the Route linked to the given page using all non-deleted pages on that route.
 * Name and coordinates come from the most popular linked page (quality × userVotes);
 * ties break by page id ascending so the updated page is not preferred solely for being updated.
 */
const updateRouteForPage = async (
    conn: db.Queryable,
    page: RopewikiPage,
): Promise<void> => {
    if (!page.id) {
        throw new Error('Page must have an id to update route');
    }

    const now = new Date();

    await db.sql<db.SQL>`
        UPDATE "Route" r
        SET
            "name" = popular.name,
            "coordinates" = popular.coordinates,
            "updatedAt" = ${db.param(now)}
        FROM "RopewikiRoute" rr
        CROSS JOIN LATERAL (
            SELECT
                p.name,
                p.coordinates
            FROM "RopewikiRoute" rr2
            INNER JOIN "RopewikiPage" p ON p.id = rr2."ropewikiPage"
            WHERE rr2.route = rr.route
              AND rr2."deletedAt" IS NULL
              AND p."deletedAt" IS NULL
              AND p.coordinates IS NOT NULL
            ORDER BY
                (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 0)) DESC,
                p.id ASC
            LIMIT 1
        ) popular
        WHERE r.id = rr.route
          AND rr."ropewikiPage" = ${db.param(page.id)}::uuid
          AND rr."deletedAt" IS NULL
          AND r."allowUpdates" = true
    `.run(conn);
};

export default updateRouteForPage;
