import * as db from 'zapatos/db';
import RopewikiPageInfo from '../types/ropewiki';

const getPagesWithoutRoutes = async (
    conn: db.Queryable,
    pages: RopewikiPageInfo[],
): Promise<RopewikiPageInfo[]> => {
    if (pages.length === 0) {
        return [];
    }

    // Extract page IDs from pages that have IDs (pages from database will have IDs)
    const pageUuids = pages.map(page => page.id).filter((id): id is string => id !== undefined);
    
    if (pageUuids.length === 0) {
        return [];
    }

    // Select page IDs that have a row in the RopewikiRoute table
    const rows = await db.sql<db.SQL, { ropewikiPage: string }[]>`
        SELECT rr."ropewikiPage"
        FROM "RopewikiRoute" rr
        INNER JOIN "RopewikiPage" rp ON rr."ropewikiPage" = rp.id
        WHERE rr."ropewikiPage" = ANY(${db.param(pageUuids)}::uuid[])
        AND rr."deletedAt" IS NULL
        AND rp."deletedAt" IS NULL
    `.run(conn);

    const pageIdsWithRoutes = new Set(rows.map(row => row.ropewikiPage));
    
    // Filter input pages to only include those without routes
    return pages.filter(page => page.id !== undefined && !pageIdsWithRoutes.has(page.id));
};

export default getPagesWithoutRoutes;
