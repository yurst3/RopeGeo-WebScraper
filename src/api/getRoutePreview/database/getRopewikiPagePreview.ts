import * as db from 'zapatos/db';
import { PageDataSource } from '../../../types/pageRoute';
import type { PagePreview } from '../../../types/pagePreview';
import type { RopewikiRoute } from '../../../types/pageRoute';

type Row = {
    pageId: string;
    title: string;
    quality: number | null;
    userVotes: number | null;
    rating: string | null;
    regionName: string;
    bannerFileUrl: string | null;
};

/**
 * Returns a single PagePreview for the given RopewikiRoute (uses its ropewikiPage id).
 * Banner image is the first image for the page that does not belong to a beta section.
 */
const getRopewikiPagePreview = async (
    conn: db.Queryable,
    ropewikiRoute: RopewikiRoute,
): Promise<PagePreview> => {
    const pageId = ropewikiRoute.page;

    const rows = await db.sql<db.SQL, Row[]>`
        SELECT
            p.id AS "pageId",
            p.name AS title,
            p.quality,
            p."userVotes",
            p.rating,
            r.name AS "regionName",
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

    return {
        id: row.pageId,
        source: PageDataSource.Ropewiki,
        imageUrl: row.bannerFileUrl ?? null,
        rating: row.quality != null ? Number(row.quality) : null,
        ratingCount: row.userVotes ?? null,
        title: row.title,
        regions: [row.regionName],
        difficulty: row.rating ?? null,
        mapData: ropewikiRoute.mapData ?? null,
    };
};

export default getRopewikiPagePreview;
