import * as db from 'zapatos/db';
import type { GetRopewikiPagePreviewRow } from 'ropegeo-common';

export type PageRow = GetRopewikiPagePreviewRow & {
    mapData: string | null;
    aka: string[];
};

type SqlRow = PageRow & { pageId: string; aka?: string[] };

/**
 * Fetches full page preview rows (for PagePreview) for the given page ids.
 * When includeAka is false, filters by page name similarity so only pages matching the
 * threshold are returned. When includeAka is true, returns all requested ids (getSearchPageIds
 * already filtered by page name or AKA name).
 */
async function getPageRowsByIds(
    conn: db.Queryable,
    name: string,
    similarityThreshold: number,
    pageIds: string[],
    options?: { includeAka?: boolean },
): Promise<Map<string, PageRow>> {
    if (pageIds.length === 0) return new Map();
    const filterByPageName = options?.includeAka !== true;
    const rows = await db.sql<db.SQL, SqlRow[]>`
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
                SELECT d."previewUrl"
                FROM "RopewikiImage" i
                INNER JOIN "ImageData" d ON d.id = i."processedImage"
                    AND d."errorMessage" IS NULL
                    AND d."previewUrl" IS NOT NULL
                WHERE i."ropewikiPage" = p.id
                  AND i."betaSection" IS NULL
                  AND i."deletedAt" IS NULL
                ORDER BY i."order" ASC NULLS LAST
                LIMIT 1
            ) AS "bannerFileUrl",
            p.url,
            p.permits,
            rr."mapData",
            (
                SELECT COALESCE(array_agg(a.name ORDER BY a.name), '{}')
                FROM "RopewikiAkaName" a
                WHERE a."ropewikiPage" = p.id AND a."deletedAt" IS NULL
            ) AS "aka"
        FROM "RopewikiPage" p
        INNER JOIN "RopewikiRegion" r ON r.id = p.region AND r."deletedAt" IS NULL
        LEFT JOIN "RopewikiRoute" rr ON rr."ropewikiPage" = p.id AND rr."deletedAt" IS NULL
        WHERE p."deletedAt" IS NULL
          AND p.id = ANY(${db.param(pageIds)}::uuid[])
          ${filterByPageName ? db.sql`AND word_similarity(${db.param(name)}, p.name) > ${db.param(similarityThreshold)}` : db.sql``}
    `.run(conn);

    const map = new Map<string, PageRow>();
    for (const row of rows) {
        map.set(row.pageId, {
            ...row,
            bannerFileUrl: row.bannerFileUrl ?? null,
            mapData: row.mapData ?? null,
            aka: row.aka ?? [],
        });
    }
    return map;
}

export default getPageRowsByIds;
