import * as db from 'zapatos/db';
import type { GetRopewikiPagePreviewRow } from 'ropegeo-common';
import { PagePreview } from 'ropegeo-common';
import type { RopewikiRoute } from '../../../types/pageRoute';
import getRopewikiRegionLineage from '../../../ropewiki/database/getRopewikiRegionLineage';

export type { GetRopewikiPagePreviewRow };

/**
 * Returns a single PagePreview for the given RopewikiRoute (uses its ropewikiPage id).
 * Banner image is the first image for the page that does not belong to a beta section.
 */
const getRopewikiPagePreview = async (
    conn: db.Queryable,
    ropewikiRoute: RopewikiRoute,
): Promise<PagePreview> => {
    const pageId = ropewikiRoute.page;

    const rows = await db.sql<db.SQL, GetRopewikiPagePreviewRow[]>`
        SELECT
            p.id AS "pageId",
            p.name AS title,
            p.quality,
            p."userVotes",
            p."technicalRating",
            p."timeRating",
            p."waterRating",
            p."riskRating",
            p.region AS "regionId",
            r.name AS "regionName",
            p.url,
            p.permits,
            (
                SELECT i."fileUrl"
                FROM "RopewikiImage" i
                WHERE i."ropewikiPage" = p.id
                  AND i."betaSection" IS NULL
                  AND i."deletedAt" IS NULL
                ORDER BY i."order" ASC NULLS LAST
                LIMIT 1
            ) AS "bannerFileUrl"
        FROM "RopewikiPage" p
        INNER JOIN "RopewikiRegion" r ON r.id = p.region AND r."deletedAt" IS NULL
        WHERE p.id = ${db.param(pageId)}::uuid
          AND p."deletedAt" IS NULL
    `.run(conn);

    const row = rows[0];
    if (!row) {
        throw new Error(`RopewikiPage not found for id: ${pageId}`);
    }

    const regionLineage = await getRopewikiRegionLineage(conn, row.regionId);
    const regions =
        regionLineage.length > 0 ? regionLineage.map((r) => r.name) : [row.regionName];
    return PagePreview.fromDbRow(row, ropewikiRoute.mapData ?? null, regions);
};

export default getRopewikiPagePreview;
