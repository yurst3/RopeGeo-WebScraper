import * as db from 'zapatos/db';
import type { GetRopewikiPagePreviewRow } from 'ropegeo-common';

export type PageRow = GetRopewikiPagePreviewRow & {
    mapData: string | null;
};

/**
 * Fetches full page preview rows (for PagePreview) for the given page ids, filtered by
 * name similarity. Returns a map from page id to row; only includes pages that match
 * the similarity threshold.
 */
async function getPageRowsByIds(
    conn: db.Queryable,
    name: string,
    similarityThreshold: number,
    pageIds: string[],
): Promise<Map<string, PageRow>> {
    if (pageIds.length === 0) return new Map();
    const rows = await db.sql<db.SQL, (PageRow & { pageId: string })[]>`
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
            (
                SELECT i."fileUrl"
                FROM "RopewikiImage" i
                WHERE i."ropewikiPage" = p.id
                  AND i."betaSection" IS NULL
                  AND i."deletedAt" IS NULL
                ORDER BY i."order" ASC NULLS LAST
                LIMIT 1
            ) AS "bannerFileUrl",
            p.url,
            p.permits,
            rr."mapData"
        FROM "RopewikiPage" p
        INNER JOIN "RopewikiRegion" r ON r.id = p.region AND r."deletedAt" IS NULL
        LEFT JOIN "RopewikiRoute" rr ON rr."ropewikiPage" = p.id AND rr."deletedAt" IS NULL
        WHERE p."deletedAt" IS NULL
          AND p.id = ANY(${db.param(pageIds)}::uuid[])
          AND word_similarity(${db.param(name)}, p.name) > ${db.param(similarityThreshold)}
    `.run(conn);
    const map = new Map<string, PageRow>();
    for (const row of rows) {
        map.set(row.pageId, {
            ...row,
            mapData: row.mapData ?? null,
        });
    }
    return map;
}

export default getPageRowsByIds;
