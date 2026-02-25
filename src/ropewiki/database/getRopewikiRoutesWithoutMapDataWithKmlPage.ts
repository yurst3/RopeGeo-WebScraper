import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import RopewikiRoute from '../../types/pageRoute';

/**
 * Returns all non-deleted RopewikiRoutes that have no mapData and whose
 * corresponding RopewikiPage has a non-null kmlUrl and is not deleted.
 */
const getRopewikiRoutesWithoutMapDataWithKmlPage = async (
    conn: db.Queryable,
): Promise<RopewikiRoute[]> => {
    const rows = await db.sql<db.SQL, s.RopewikiRoute.JSONSelectable[]>`
        SELECT rr."route", rr."ropewikiPage", rr."mapData", rr."createdAt", rr."updatedAt", rr."deletedAt"
        FROM "RopewikiRoute" rr
        INNER JOIN "RopewikiPage" rp ON rr."ropewikiPage" = rp.id
        WHERE rr."mapData" IS NULL
          AND rr."deletedAt" IS NULL
          AND rp."deletedAt" IS NULL
          AND rp."kmlUrl" IS NOT NULL
          AND rp."kmlUrl" != ''
        ORDER BY rr."route", rr."ropewikiPage"
    `.run(conn);

    return rows.map((row) => RopewikiRoute.fromDbRow(row));
};

export default getRopewikiRoutesWithoutMapDataWithKmlPage;
