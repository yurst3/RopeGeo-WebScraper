import * as db from 'zapatos/db';
import { RopewikiRoute } from '../../types/pageRoute';

// Insert or update a RopewikiRoute record.
// ON CONFLICT (route, ropewikiPage) DO UPDATE SET ... WHERE allowUpdates = true.
const upsertRopewikiRoute = async (
    conn: db.Queryable,
    ropewikiRoute: RopewikiRoute,
): Promise<void> => {
    const row = ropewikiRoute.toDbRow();

    await db.sql`
        INSERT INTO "RopewikiRoute" ("route", "ropewikiPage", "mapData", "updatedAt", "deletedAt")
        VALUES (
            ${db.param(row.route)}::uuid,
            ${db.param(row.ropewikiPage)}::uuid,
            ${db.param(row.mapData)}::uuid,
            ${db.param(row.updatedAt)},
            ${db.param(row.deletedAt)}
        )
        ON CONFLICT ("route", "ropewikiPage") DO UPDATE SET
            "mapData" = EXCLUDED."mapData",
            "updatedAt" = EXCLUDED."updatedAt",
            "deletedAt" = EXCLUDED."deletedAt"
        WHERE "RopewikiRoute"."allowUpdates" = true
    `.run(conn);
};

export default upsertRopewikiRoute;
